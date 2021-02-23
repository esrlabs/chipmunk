use indexer_base::{progress::ComputationResult, utils};
use serde::{Deserialize, Serialize};
use std::{
    fmt, fs,
    io::{Read, Seek, SeekFrom, Write},
    ops::RangeInclusive,
    path::{Path, PathBuf},
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GrabError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0:?})")]
    IoOperation(#[from] std::io::Error),
    #[error("Invalid range: ({0:?})")]
    InvalidRange(LineRange),
    #[error("Grabber interrupted")]
    Interrupted,
    #[error("Metadata initialization not done")]
    NotInitialize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GrabbedElement {
    #[serde(rename = "id")]
    pub source_id: String,
    #[serde(rename = "c")]
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GrabbedContent {
    pub grabbed_elements: Vec<GrabbedElement>,
}

const DEFAULT_SLOT_SIZE: usize = 64 * 1024usize;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ByteIdentifier;
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineIdentifier;

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct GrabRange<T> {
    pub range: RangeInclusive<u64>,
    phantom: std::marker::PhantomData<T>,
}
pub type ByteRange = GrabRange<ByteIdentifier>;
pub type LineRange = GrabRange<LineIdentifier>;

impl<T> fmt::Debug for GrabRange<T> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self.range)
    }
}

impl<T> GrabRange<T> {
    pub fn from(range: RangeInclusive<u64>) -> Self {
        Self {
            range,
            phantom: std::marker::PhantomData,
        }
    }

    pub fn single_line(index: u64) -> Self {
        Self {
            range: (index..=index),
            phantom: std::marker::PhantomData,
        }
    }

    pub fn start(&self) -> u64 {
        *self.range.start()
    }

    pub fn end(&self) -> u64 {
        *self.range.end()
    }

    pub fn size(&self) -> u64 {
        if self.range.is_empty() {
            return 0;
        }
        self.range.end() - self.range.start() + 1
    }

    pub fn is_empty(&self) -> bool {
        self.range.is_empty()
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
        self.bytes.size()
    }
    pub fn line_count(&self) -> u64 {
        self.lines.size()
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
        shutdown_rx: Option<cc::Receiver<()>>,
    ) -> Result<(), GrabError> {
        if self.metadata.is_none() {
            if let ComputationResult::Item(md) =
                Grabber::create_metadata_for_file(&self.path, shutdown_rx)?
            {
                self.metadata = Some(md)
            }
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
        let input_file_size = std::fs::metadata(&path)?.len();
        if input_file_size == 0 {
            return Err(GrabError::Config("Cannot grab empty file".to_string()));
        }

        let metadata = match Grabber::create_metadata_for_file(&path, None)? {
            ComputationResult::Item(md) => Ok(Some(md)),
            ComputationResult::Stopped => Err(GrabError::Interrupted),
        }?;

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

    /// if the metadata was already created, we know the number of log entries in a file
    pub fn log_entry_count(&self) -> Option<usize> {
        self.metadata.as_ref().map(|md| md.line_count)
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

    pub async fn create_metadata_async(
        path: impl AsRef<Path>,
    ) -> Result<ComputationResult<GrabMetadata>, GrabError> {
        log::trace!("create_metadata_async");
        let p = PathBuf::from(path.as_ref());
        let res = tokio::task::spawn_blocking(move || {
            Grabber::create_metadata_for_file(p, None).unwrap()
            // use tokio::fs::File;
            // use tokio::io::AsyncReadExt;
            // let f = File::open(&path).await?;
            // let mut reader = tokio::io::BufReader::new(f);
            // // let input_file_size = tokio::fs::metadata(&path).await?.len();
            // let mut slots = Vec::<Slot>::new();

            // let mut buffer = vec![0; DEFAULT_SLOT_SIZE];
            // let mut byte_index = 0u64;
            // let mut processed_lines = 0u64;
            // while let Ok(len) = reader.read(&mut buffer).await {
            //     // TODO check for shutdown
            //     // if utils::check_if_stop_was_requested(shutdown_receiver.as_ref(), "grabber") {
            //     //     result_sender
            //     //         .send(Progress::Stopped)
            //     //         .map_err(|_| GrabError::Communication("Could not send progress".to_string()))?;
            //     //     return Ok(None);
            //     // }
            //     if len == 0 {
            //         break;
            //     }
            //     if len < DEFAULT_SLOT_SIZE {
            //         buffer.resize(len, 0);
            //     }
            //     let line_count = bytecount::count(&buffer, b'\n') as u64
            //         + if buffer.last() == Some(&b'\n') { 0 } else { 1 };
            //     let slot = Slot {
            //         bytes: ByteRange::new(byte_index, byte_index + len as u64),
            //         lines: LineRange::new(processed_lines, processed_lines + line_count),
            //     };
            //     slots.push(slot);
            //     byte_index += len as u64;
            //     processed_lines += line_count;
            //     if buffer.last() == Some(&b'\n') {
            //         println!(">> last char for line {} was a \\n", processed_lines);
            //     } else if buffer.last() == Some(&b'\r') {
            //         println!(
            //             "last char for line {} was a {:?}",
            //             processed_lines,
            //             buffer.last()
            //         );
            //     }
            //     // TODO generate update events
            //     // result_sender
            //     //     .send(Progress::ticks(byte_index, input_file_size))
            //     //     .map_err(|_| GrabError::Communication("Could not send progress".to_string()))?;
            // }
            // // TODO generate done event
            // // result_sender
            // //     .send(Progress::ticks(input_file_size, input_file_size))
            // //     .map_err(|_| GrabError::Communication("Could not send progress".to_string()))?;
            // Ok(Some(GrabMetadata {
            //     slots,
            //     line_count: processed_lines as usize,
            // }))
        })
        .await;
        let g: ComputationResult<GrabMetadata> =
            res.map_err(|e| GrabError::Config(format!("Error executing async grab: {}", e)))?;
        Ok(g)
    }

    pub fn create_metadata_for_file(
        path: impl AsRef<Path>,
        shutdown_receiver: Option<cc::Receiver<()>>,
    ) -> Result<ComputationResult<GrabMetadata>, GrabError> {
        let f = fs::File::open(&path)?;
        let mut reader = std::io::BufReader::new(f);
        let mut slots = Vec::<Slot>::new();

        // let mut buffer = vec![0; DEFAULT_SLOT_SIZE];
        let mut buffer = vec![0; 20usize];

        let mut byte_index = 0u64;
        let mut processed_lines = 0u64;
        while let Ok(len) = reader.read(&mut buffer) {
            if utils::check_if_stop_was_requested(shutdown_receiver.as_ref(), "grabber") {
                return Ok(ComputationResult::Stopped);
            }
            if len == 0 {
                break;
            }
            if len < DEFAULT_SLOT_SIZE {
                buffer.resize(len, 0);
            }
            let nl_count = bytecount::count(&buffer, b'\n') as u64;
            let (line_count, byte_count) = (nl_count + 1, len as u64);
            let line_rang_start = if processed_lines > 0 {
                processed_lines - 1
            } else {
                0
            };
            let slot = Slot {
                bytes: ByteRange::from(byte_index..=byte_index + byte_count - 1),
                lines: LineRange::from(line_rang_start..=processed_lines + line_count - 1),
            };
            if processed_lines < 20 {
                println!("[processed slot] {:?}", slot);
            }
            slots.push(slot);
            byte_index += len as u64;
            processed_lines += line_count;
        }
        Ok(ComputationResult::Item(GrabMetadata {
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

    /// Get all lines in a file within the supplied line-range
    /// naive implementation that just reads all slots that are involved and drops
    /// everything that is not needed
    pub fn get_entries(&self, line_range: &LineRange) -> Result<GrabbedContent, GrabError> {
        println!("get_entries for range: {:?}", line_range);
        match &self.metadata {
            None => Err(GrabError::NotInitialize),
            Some(metadata) => {
                if line_range.range.is_empty() {
                    return Err(GrabError::InvalidRange(line_range.clone()));
                }
                use std::io::prelude::*;

                let file_part = identify_byte_range(&metadata.slots, line_range)
                    .ok_or_else(|| GrabError::InvalidRange(line_range.clone()))?;
                println!("file-part: {:?}", file_part);

                let mut read_buf = vec![0; file_part.length];
                let mut read_from = fs::File::open(&self.path)?;

                read_from.seek(SeekFrom::Start(file_part.offset_in_file))?;
                read_from.read_exact(&mut read_buf)?;
                let s = unsafe { std::str::from_utf8_unchecked(&read_buf) };
                println!("skipping {} lines", file_part.lines_to_skip);

                let all_lines = s.split(|c| c == '\n' || c == '\r');
                let lines_minus_end =
                    all_lines.take(file_part.total_lines - file_part.lines_to_drop);
                let pure_lines = lines_minus_end.skip(file_part.lines_to_skip);
                let grabbed_elements = pure_lines
                    .map(|s| GrabbedElement {
                        source_id: self.source_id.clone(),
                        content: s.to_owned(),
                    })
                    .collect::<Vec<GrabbedElement>>();
                Ok(GrabbedContent { grabbed_elements })
            }
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FilePart {
    pub offset_in_file: u64,
    pub length: usize, // how many bytes
    pub total_lines: usize,
    pub lines_to_skip: usize,
    pub lines_to_drop: usize,
}
/// given a list of slots that define byte and line ranges, this function will
/// find the byte range that needs to be read so that all content in lines is captured.
/// It will also return how many lines are in this byte-range and how many need to be skipped
/// at the beginning and dropped the end to get only the desired content
pub(crate) fn identify_byte_range(slots: &[Slot], lines: &LineRange) -> Option<FilePart> {
    if lines.is_empty() {
        return None;
    }
    let start_line_index = lines.start();
    let last_line_index = lines.end();
    let maybe_start_slot = identify_start_slot_simple(&slots, start_line_index);
    let maybe_end_slot = identify_end_slot_simple(&slots, last_line_index);
    match (maybe_start_slot, maybe_end_slot) {
        (Some((start_slot, _)), Some((end_slot, _))) => {
            let lines_to_skip = start_line_index - start_slot.lines.start();
            let lines_to_drop = end_slot.lines.end() - last_line_index;
            let total_lines = end_slot.lines.end() - start_slot.lines.start() + 1;
            let byte_range = ByteRange::from(start_slot.bytes.start()..=end_slot.bytes.end());
            Some(FilePart {
                offset_in_file: byte_range.start(),
                length: byte_range.size() as usize,
                total_lines: total_lines as usize,
                lines_to_skip: lines_to_skip as usize,
                lines_to_drop: lines_to_drop as usize,
            })
        }
        _ => None,
    }
}

pub(crate) fn identify_end_slot_simple(slots: &[Slot], line_index: u64) -> Option<(Slot, usize)> {
    match slots.len() {
        0 => None,
        slots_len => {
            let mut i = slots_len - 1;
            for slot in slots.iter().rev() {
                if slot.lines.range.contains(&line_index) {
                    return Some((slot.clone(), i));
                }
                i -= 1;
            }
            None
        }
    }
}

pub(crate) fn identify_start_slot_simple(slots: &[Slot], line_index: u64) -> Option<(Slot, usize)> {
    for (i, slot) in slots.iter().enumerate() {
        if slot.lines.range.contains(&line_index) {
            return Some((slot.clone(), i));
        }
    }
    None
}
/// In order to quickly identify the byte index of a line in a logfile,
/// we devide the logfile into slots that store the byte offsets.
/// When we now want to find out the byte offset of a line, we first can quickly
/// identify in which slot it is
pub(crate) fn identify_start_slot(slots: &[Slot], line_index: u64) -> Option<(Slot, usize)> {
    println!("identify index {}", line_index);
    use std::cmp::Ordering;
    if slots.is_empty() {
        return None;
    }
    if let Ok(found) = slots.binary_search_by(|slot| {
        println!("slot {:?}", slot);
        if slot.lines.start() > line_index {
            println!("slot.lines.range.start > {}", line_index);
            return Ordering::Greater;
        }
        if slot.lines.start() <= line_index && line_index <= slot.lines.end() {
            println!(
                "FOUND: slot.lines.range.start <= {} <= slot.lines.last_included",
                line_index,
            );
            return Ordering::Equal;
        }
        println!("Less");
        Ordering::Less
    }) {
        return Some((slots[found].clone(), found));
    } // let mut to_investigate = (0, metadata.slots.len() - 1);
      // loop {
      //     let slot_mid_index = (to_investigate.0 + to_investigate.1) / 2;
      //     let slot = &metadata.slots[slot_mid_index];
      //     // println!("examine slot {:?}", slot.lines);
      //     if (line_index == 0 && slot.lines.range.start == 0)
      //         || slot.lines.range.contains(&line_index)
      //     {
      //         // println!("found it! 1");
      //         return Some((slot.clone(), slot_mid_index));
      //     }
      //     if to_investigate.1 - to_investigate.0 <= 1 {
      //         // only 2 possibilities left
      //         // we already checked slot_mid_index which equals to_investigate.0
      //         // so check the last possibility
      //         // let (r, (lower, upper)) = self.slots[to_investigate.1];
      //         let slot = &metadata.slots[to_investigate.1];
      //         if slot.lines.range.contains(&line_index) {
      //             // println!("found it! 2");
      //             return Some((slot.clone(), to_investigate.1));
      //         }
      //         break; // not found -> exit
      //     }
      //     let old_to_investigate = to_investigate;
      //     if line_index < slot.lines.range.start {
      //         to_investigate = (to_investigate.0, slot_mid_index);
      //     } else {
      //         to_investigate = (slot_mid_index, to_investigate.1);
      //     }
      //     if to_investigate == old_to_investigate {
      //         break;
      //     }
      // }
    None
}
