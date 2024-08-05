//! This is an example of a simple Chipmunk bytesource plugin that reads byte data from a file,
//! and provides it to the Chipmunk application.
//!
//! TODO: Complete the documentation

use std::{
    fs::File,
    io::{BufReader, Read},
    path::PathBuf,
};

use plugins_api::{
    bytesource::{ByteSource, InitError, InputSource, SourceConfig, SourceError},
    bytesource_export,
};

/// Simple struct that opens a file and read its content, providing them as bytes to Chipmunk when
/// read method for the plugin is called
struct FileSource {
    reader: BufReader<File>,
}

impl ByteSource for FileSource {
    fn create(
        input_source: InputSource,
        _general_configs: SourceConfig,
        _config_path: Option<PathBuf>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        let file_path = match input_source {
            InputSource::File(path) => PathBuf::from(path),
            _ => return Err(InitError::Unsupported("Input Type must be a file".into())),
        };

        let file = File::open(file_path).map_err(|err| InitError::Io(err.to_string()))?;
        let reader = BufReader::new(file);

        let source = FileSource { reader };

        Ok(source)
    }

    fn read(&mut self, len: usize) -> Result<Vec<u8>, SourceError> {
        //TODO: Remove unsafe code if this binary will not used for benchmarking.
        // Initialize a vector with the given length to use as buffer for reading from the file
        let mut buf = Vec::with_capacity(len);

        // SAFETY: truncate is called on the buffer after read call with the read amount of bytes.
        // Even with unwind after panic, this shouldn't cause undefined behavior since the vector has only bytes which
        // don't have a special drop implementation.
        unsafe {
            buf.set_len(len);
        }

        let bytes_read = self
            .reader
            .read(&mut buf)
            .map_err(|err| SourceError::Io(format!("Error while reading from file: {}", err)))?;

        // Remove uninitialized bytes from the buffer which haven't been re-written with the file data.
        if bytes_read < len {
            buf.truncate(bytes_read);
        }

        Ok(buf)
    }
}

bytesource_export!(FileSource);
