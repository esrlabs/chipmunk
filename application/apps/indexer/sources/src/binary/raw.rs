use bufread::BufReader;
use components::{ComponentFactory, ComponentDescriptor};
use definitions::*;
use file_tools::is_binary;
use std::{
    fs::File,
    io::{BufRead, Read},
    path::Path,
};
use stypes::SourceOrigin;

pub struct BinaryByteSource<R>
where
    R: Read,
{
    reader: BufReader<R>,
}

impl<R> BinaryByteSource<R>
where
    R: Read + Unpin,
{
    /// create a new `BinaryByteSource` with default buffer settings for reading
    pub fn new(input: R) -> BinaryByteSource<R> {
        let reader = BufReader::new(DEFAULT_READER_CAPACITY, DEFAULT_MIN_BUFFER_SPACE, input);
        BinaryByteSource { reader }
    }

    /// create a new `BinaryByteSource` with custom buffer settings.
    /// the `total_capacity` specifies how big the underlying used buffers should be at least
    /// the `min_space` will make sure that the buffer is filled with at least that many bytes
    pub fn custom(input: R, total_capacity: usize, min_space: usize) -> BinaryByteSource<R> {
        let reader = BufReader::new(total_capacity, min_space, input);
        BinaryByteSource { reader }
    }
}

impl<R: Read + Send> ByteSource for BinaryByteSource<R> {
    async fn load(&mut self, _: Option<&SourceFilter>) -> Result<Option<ReloadInfo>, SourceError> {
        let initial_buf_len = self.reader.len();
        trace!(
            "before: capacity: {} (buf_len: {})",
            self.reader.capacity(),
            initial_buf_len
        );
        let available = {
            let content = self
                .reader
                .fill_buf()
                .map_err(|e| SourceError::Unrecoverable(format!("Could not fill buffer: {e}")))?;
            content.len()
        };
        let newly_loaded_bytes = available.saturating_sub(initial_buf_len);
        trace!(
            "after: capacity: {} (newly loaded: {})",
            self.reader.capacity(),
            newly_loaded_bytes
        );
        if available == 0 {
            trace!("0, Ok(None)");
            return Ok(None);
        }
        Ok(Some(ReloadInfo::new(
            newly_loaded_bytes,
            available,
            0,
            None,
        )))
    }

    fn current_slice(&self) -> &[u8] {
        self.reader.buffer()
    }
    fn consume(&mut self, offset: usize) {
        trace!("consume {} bytes", offset);
        self.reader.consume(offset);
    }

    fn len(&self) -> usize {
        self.reader.len()
    }
}

pub struct BinaryByteSourceFromFile {
    inner: BinaryByteSource<File>,
}

impl BinaryByteSourceFromFile {
    pub fn new<P: AsRef<Path>>(filename: P) -> Result<Self, stypes::NativeError> {
        fn input_file(filename: &Path) -> Result<File, stypes::NativeError> {
            File::open(filename).map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Io,
                message: Some(format!(
                    "Fail open file {}: {}",
                    filename.to_string_lossy(),
                    e
                )),
            })
        }
        Ok(Self {
            inner: BinaryByteSource::new(input_file(filename.as_ref())?),
        })
    }
}

impl ByteSource for BinaryByteSourceFromFile {
    async fn load(
        &mut self,
        filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        self.inner.load(filter).await
    }

    fn current_slice(&self) -> &[u8] {
        self.inner.current_slice()
    }
    fn consume(&mut self, offset: usize) {
        self.inner.consume(offset)
    }

    fn len(&self) -> usize {
        self.inner.len()
    }
}

const BIN_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Source> for Descriptor {
    fn create(
        &self,
        origin: &SourceOrigin,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Source>, stypes::NativeError> {
        let filename = match origin {
            SourceOrigin::File(filename) => filename,
            _ => {
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Configuration,
                    message: Some(
                        "origin isn't supported by this source (BinaryByteSource)".to_owned(),
                    ),
                })
            }
        };
        Ok(Some(crate::Source::Raw(BinaryByteSourceFromFile::new(
            filename,
        )?)))
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SourceOrigin) -> bool {
        let files = match origin {
            SourceOrigin::File(filepath) => {
                vec![filepath]
            }
            SourceOrigin::Files(files) => files.iter().collect(),
            SourceOrigin::Source => {
                return false;
            }
        };
        // If at least some file doesn't exist or not binary - do not recommend this source
        !files
            .into_iter()
            .any(|f| !f.exists() || !is_binary(f.to_string_lossy().to_string()).unwrap_or_default())
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Binary Source"),
            desc: String::from("Binary Source"),
            uuid: BIN_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        binary::raw::BinaryByteSource,
        tests::{general_source_reload_test, MockRead},
        ByteSource,
    };
    use env_logger;
    use std::sync::Once;

    static INIT: Once = Once::new();

    /// Setup function that is only run once, even if called multiple times.
    fn setup() {
        INIT.call_once(|| {
            _ = env_logger::try_init();
        });
    }
    #[tokio::test]
    async fn test_binary_load() {
        setup();
        use std::io::{Cursor, Write};
        struct Frame {
            len: u8,
            content: Vec<u8>,
        }
        impl Frame {
            fn new(content: Vec<u8>) -> Self {
                Self {
                    len: content.len() as u8,
                    content,
                }
            }
        }

        let v: Vec<u8> = Vec::new();
        let mut buff = Cursor::new(v);

        let frame_cnt = 100;
        let total_capacity = 10;
        let min_space = 5;

        for _ in 0..frame_cnt {
            let frame = Frame::new(vec![0xA, 0xB, 0xC]);
            buff.write_all(&[frame.len]).unwrap();
            buff.write_all(&frame.content).unwrap();
        }
        buff.set_position(0);

        let total = frame_cnt * 4;
        let mut binary_source = BinaryByteSource::custom(buff, total_capacity, min_space);
        let mut consumed_bytes = 0usize;
        let mut consumed_msg = 0usize;
        while let Some(reload_info) = binary_source.load(None).await.unwrap() {
            assert!(reload_info.available_bytes >= 4);
            consumed_bytes += 4;
            consumed_msg += 1;
            binary_source.consume(4);
        }
        assert_eq!(consumed_bytes, total);
        assert_eq!(consumed_msg, frame_cnt);
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        let reader = MockRead::default();
        let mut binary_source = BinaryByteSource::new(reader);

        general_source_reload_test(&mut binary_source).await;
    }
}
