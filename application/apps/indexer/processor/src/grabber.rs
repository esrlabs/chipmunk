use indexer_base::progress::Ticks;
use indexer_base::{
    progress::{IndexingProgress, IndexingResults, Progress},
    utils,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Seek, SeekFrom, Write},
    ops::Range,
    path::{Path, PathBuf},
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GrabError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(#[from] std::io::Error),
    #[error("Invalid range: ({0:?})")]
    InvalidRange(LineRange),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GrabbedElement {
    pub source_id: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GrabbedContent {
    pub grabbed_elements: Vec<GrabbedElement>,
}

const DEFAULT_SLOT_SIZE: usize = 64 * 1024usize;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ByteRange {
    pub range: Range<u64>,
}
impl ByteRange {
    pub fn new(start: u64, end: u64) -> Self {
        Self {
            range: Range { start, end },
        }
    }
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineRange {
    pub range: Range<u64>,
}
impl LineRange {
    pub fn new(start: u64, end: u64) -> Self {
        Self {
            range: Range { start, end },
        }
    }
}
#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Slot {
    pub bytes: ByteRange,
    pub lines: LineRange,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GrabMetadata {
    /// mapping that contains the byte offset -> newline count in the section
    /// e.g.    (0,999) -> 233 (233 newlines in [0,999])
    ///         (1000,1999) -> 199 (199 newlines in [1000,1999])
    pub slots: Vec<Slot>,
    pub line_count: usize,
}

impl std::fmt::Debug for Slot {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "Slot: bytes: [{:?}], lines: [{:?}]",
            self.bytes.range, self.lines.range,
        )
    }
}

impl Slot {
    pub fn byte_count(&self) -> u64 {
        self.bytes.range.end - self.bytes.range.start
    }
    pub fn line_count(&self) -> u64 {
        self.lines.range.end - self.lines.range.start
    }
}

#[derive(Debug)]
pub struct Grabber {
    pub source_id: String,
    pub path: PathBuf,
    pub metadata: Option<GrabMetadata>,
    pub input_file_size: u64,
    pub last_line_empty: bool,
}

impl Grabber {
    /// Create a new Grabber without creating the metadata
    /// ...
    /// A new Grabber instance can only be created if the file is non-empty,
    /// otherwise this function will return an error
    pub fn lazy(path: impl AsRef<Path>, source_id: &str) -> Result<Self, GrabError> {
        let input_file_size = std::fs::metadata(&path)
            .map_err(|e| {
                GrabError::Config(format!("Could not determine size of input file: {}", e))
            })?
            .len();
        if input_file_size == 0 {
            return Err(GrabError::Config("Cannot grab empty file".to_string()));
        }

        Ok(Self {
            source_id: source_id.to_owned(),
            path: path.as_ref().to_owned(),
            metadata: None,
            input_file_size,
            last_line_empty: Grabber::last_line_empty(&path)?,
        })
    }

    /// If a grabber was created lazily, the metadata can be created with this
    /// function.
    pub fn create_metadata(
        &mut self,
        result_sender: cc::Sender<Progress>,
        shutdown_rx: Option<cc::Receiver<()>>,
    ) -> Result<(), GrabError> {
        if self.metadata.is_none() {
            self.metadata =
                Grabber::create_metadata_for_file(&self.path, &result_sender, shutdown_rx)?;
        }
        Ok(())
    }

    /// Create a new Grabber by deviding the file content into slots
    /// [0-1023] => line 0 - 23
    /// [1024-2047] => line 24 - 38
    /// ...
    /// A new Grabber instance can only be created if the file is non-empty,
    /// otherwise this function will return an error
    pub fn new(path: impl AsRef<Path>, source_id: &str) -> Result<Self, GrabError> {
        let input_file_size = std::fs::metadata(&path)
            .map_err(|e| GrabError::Config("Could not get metadata of file to grab".to_string()))?
            .len();
        if input_file_size == 0 {
            return Err(GrabError::Config("Cannot grab empty file".to_string()));
        }

        let unused_channel = cc::unbounded();
        let metadata = Grabber::create_metadata_for_file(&path, &unused_channel.0, None)?;

        Ok(Self {
            source_id: source_id.to_owned(),
            path: path.as_ref().to_owned(),
            metadata,
            input_file_size,
            last_line_empty: Grabber::last_line_empty(&path)?,
        })
    }

    /// if the metadata for a path already exists, it can be read
    /// from a file
    pub fn load_metadata(mut self, slots_path: impl AsRef<Path>) -> Result<Self, GrabError> {
        let mut slots_file = fs::File::open(&slots_path)
            .map_err(|e| GrabError::Config(format!("Could not open slot file: {}", e)))?;
        let mut buffer = vec![];
        let _bytes_read = slots_file.read_to_end(&mut buffer);
        self.metadata = Some(
            bincode::deserialize(&buffer)
                .map_err(|_| GrabError::Config("Could not deserialize metadata".to_string()))?,
        );
        Ok(self)
    }

    fn last_line_empty(path: impl AsRef<Path>) -> Result<bool, GrabError> {
        let mut f = fs::File::open(&path)
            .map_err(|e| GrabError::Config(format!("Could not open file to grab: {}", e)))?;
        f.seek(SeekFrom::End(-1))
            .map_err(|e| GrabError::Config(format!("Could seek to end of file: {}", e)))?;
        let mut buffer = vec![0; 1];
        let len = f.read(&mut buffer)?;
        if len == 0 {
            unreachable!("There must be a last line");
        }
        Ok(buffer[0] == b'\n' || buffer[0] == b'\r')
    }

    pub fn create_metadata_for_file(
        path: impl AsRef<Path>,
        result_sender: &cc::Sender<Progress>,
        shutdown_receiver: Option<cc::Receiver<()>>,
    ) -> Result<Option<GrabMetadata>, GrabError> {
        let mut f = fs::File::open(&path)
            .map_err(|e| GrabError::Config(format!("Could not open file to grab: {}", e)))?;
        let input_file_size = std::fs::metadata(&path)
            .map_err(|e| GrabError::Config("Could not determine size of file".to_string()))?
            .len();
        let mut slots = Vec::<Slot>::new();

        let mut buffer = vec![0; DEFAULT_SLOT_SIZE];
        let mut byte_index = 0u64;
        let mut processed_lines = 0u64;
        while let Ok(len) = f.read(&mut buffer) {
            if utils::check_if_stop_was_requested(shutdown_receiver.as_ref(), "grabber") {
                result_sender
                    .send(Progress::Stopped)
                    .map_err(|_| GrabError::Communication("Could not send progress".to_string()))?;
                return Ok(None);
            }
            if len == 0 {
                break;
            }
            if len < DEFAULT_SLOT_SIZE {
                buffer.resize(len, 0);
            }
            let line_count = bytecount::count(&buffer, b'\n') as u64 + 1;
            let slot = Slot {
                bytes: ByteRange::new(byte_index, byte_index + len as u64),
                lines: LineRange::new(processed_lines, processed_lines + line_count),
            };
            slots.push(slot);
            byte_index += len as u64;
            processed_lines += line_count;
            result_sender
                .send(Progress::ticks(byte_index, input_file_size))
                .map_err(|_| GrabError::Communication("Could not send progress".to_string()))?;
        }
        result_sender
            .send(Progress::ticks(input_file_size, input_file_size))
            .map_err(|_| GrabError::Communication("Could not send progress".to_string()))?;
        Ok(Some(GrabMetadata {
            slots,
            line_count: processed_lines as usize,
        }))
    }

    pub fn export_slots(
        &self,
        out_path: impl AsRef<Path> + std::fmt::Debug,
    ) -> Result<(), GrabError> {
        let encoded: Vec<u8> = bincode::serialize(&self.metadata)
            .map_err(|_| GrabError::Config("Could not serialize metadata".to_string()))?;
        let mut output = fs::File::create(&out_path)?;
        output.write_all(&encoded)?;
        Ok(())
    }

    /// In order to quickly identify the byte index of a line in a logfile,
    /// we devide the logfile into slots that store the byte offsets.
    /// When we now want to find out the byte offset of a line, we first can quickly
    /// identify in which slot it is
    pub(crate) fn identify_slot(&self, line_index: u64) -> Option<Slot> {
        let metadata = self.metadata.as_ref()?;
        if metadata.slots.is_empty() {
            return None;
        }
        let mut to_investigate = (0, metadata.slots.len() - 1);
        loop {
            let slot_mid_index = (to_investigate.0 + to_investigate.1) / 2;
            let slot = &metadata.slots[slot_mid_index];
            if (line_index == 0 && slot.lines.range.start == 0)
                || slot.lines.range.contains(&line_index)
            {
                return Some(slot.clone());
            }
            if to_investigate.1 - to_investigate.0 <= 1 {
                // only 2 possibilities left
                // we already checked slot_mid_index which equals to_investigate.0
                // so check the last possibility
                // let (r, (lower, upper)) = self.slots[to_investigate.1];
                let slot = &metadata.slots[to_investigate.1];
                if slot.lines.range.contains(&line_index) {
                    return Some(slot.clone());
                }
                break; // not found -> exit
            }
            let old_to_investigate = to_investigate;
            if line_index < slot.lines.range.start {
                to_investigate = (to_investigate.0, slot_mid_index);
            } else {
                to_investigate = (slot_mid_index, to_investigate.1);
            }
            if to_investigate == old_to_investigate {
                break;
            }
        }
        None
    }

    /// Get all lines in a file within the supplied line-range
    /// naive implementation that just reads all slots that are involved and drops
    /// everything that is not needed
    pub fn get_entries(&self, line_range: &LineRange) -> Result<GrabbedContent, GrabError> {
        if line_range.range.end <= line_range.range.start {
            return Err(GrabError::InvalidRange(line_range.clone()));
        }
        use std::io::prelude::*;
        let maybe_start_slot = self.identify_slot(line_range.range.start);
        let maybe_end_slot = self.identify_slot(line_range.range.end - 1);
        trace!(
            "get_entries({} lines).\n\tstart-slot {:?}\n\tend-slot: {:?}",
            line_range.range.end - line_range.range.start,
            maybe_start_slot,
            maybe_end_slot
        );

        match (maybe_start_slot, maybe_end_slot) {
            (Some(start_slot), Some(end_slot)) => {
                let mut read_buf =
                    vec![0; (end_slot.bytes.range.end - start_slot.bytes.range.start) as usize];
                let mut read_from = fs::File::open(&self.path)?;
                read_from.seek(SeekFrom::Start(start_slot.bytes.range.start))?;
                read_from.read_exact(&mut read_buf)?; //.with_context(|| {
                                                      //     format!("Failed to read bytes from {}", &self.path.display())
                                                      // })?;
                let to_skip = line_range.range.start - start_slot.lines.range.start;
                let to_take = line_range.range.end - line_range.range.start;
                let s = unsafe { std::str::from_utf8_unchecked(&read_buf) };
                let grabbed_elements = s
                    .split(|c| c == '\n' || c == '\r')
                    .skip(to_skip as usize)
                    .take(to_take as usize)
                    .map(|s| GrabbedElement {
                        source_id: self.source_id.clone(),
                        content: s.to_owned(),
                    })
                    .collect::<Vec<GrabbedElement>>();
                Ok(GrabbedContent { grabbed_elements })
            }
            _ => Ok(GrabbedContent {
                grabbed_elements: vec![],
            }),
        }
    }

    #[allow(dead_code)]
    pub(crate) fn count_lines(path: impl Into<PathBuf>) -> Result<usize, GrabError> {
        let chunk_size = 100 * 1024usize;
        let mut f = fs::File::open(path.into())?;
        let mut count = 0usize;
        let mut buffer = vec![0; chunk_size];

        loop {
            let n = f.read(&mut buffer)?;
            if n < chunk_size {
                buffer.resize(n, 0);
            }
            if n == 0 {
                break;
            }
            count += bytecount::count(&buffer, b'\n');
            if n < chunk_size {
                break;
            }
        }
        Ok(count)
    }
}
