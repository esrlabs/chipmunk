use dlt_core::{
    dlt::{Argument, LogLevel, Message, MessageType, PayloadContent, Value},
    filtering::DltFilterConfig,
};
use futures::{pin_mut, stream::StreamExt};
use parsers::{dlt::DltParser, MessageStreamItem};
use sources::{producer::MessageProducer, raw::binary::BinaryByteSource};
use std::{
    collections::HashMap,
    fs::{File, OpenOptions},
    io::{BufReader, Read, Seek, Write},
    marker::{Send, Sync},
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

const FT_START_TAG: &str = "FLST";
const FT_DATA_TAG: &str = "FLDA";
const FT_END_TAG: &str = "FLFI";

/// List of DLT-FT messages.
#[derive(Debug, PartialEq, Eq)]
pub enum FtMessage<'a> {
    /// Item for a DLT-FT start message.
    Start(FileStart),
    /// Item for a DLT-FT data message.
    Data(FileData<'a>),
    /// Item for a DLT-FT end message.
    End(FileEnd),
}

/// A DLT-FT start message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileStart {
    /// The timestamp of the DLT message, if any.
    pub timestamp: Option<u32>,
    /// The id of the file.
    pub id: u32,
    /// The name of the file.
    pub name: String,
    /// The total size of the file.
    pub size: u32,
    /// The creation date of the file.
    pub created: String,
    /// The total number of packets.
    pub packets: u32,
}

impl FileStart {
    /// Returns a file-system save name, prefixed by either
    /// the timestamp of the DLT message, or if not available
    /// the id of the file.
    pub fn save_name(&self) -> String {
        format!(
            "{}_{}",
            if let Some(timestamp) = self.timestamp {
                timestamp
            } else {
                self.id
            },
            self.name.replace(['\\', '/'], "$").replace(' ', "_")
        )
    }
}

/// A DLT-FT data message.
#[derive(Debug, PartialEq, Eq)]
pub struct FileData<'a> {
    /// The timestamp of the DLT message, if any.
    pub timestamp: Option<u32>,
    /// The id of the file.
    pub id: u32,
    /// The index of the packet (1-based).
    pub packet: u32,
    /// The payload of the packet.
    pub bytes: &'a Vec<u8>,
}

/// A DLT-FT end message.
#[derive(Debug, PartialEq, Eq)]
pub struct FileEnd {
    /// The timestamp of the DLT message, if any.
    pub timestamp: Option<u32>,
    /// The id of the file.
    pub id: u32,
}

/// A parser for DLT-FT messages.
pub struct FtMessageParser;

impl FtMessageParser {
    /// Parses a DLT-FT message from a DLT message, if any.
    pub fn parse(message: &Message) -> Option<FtMessage> {
        if let Some(ext_header) = &message.extended_header {
            if let MessageType::Log(LogLevel::Info) = ext_header.message_type {
                if let PayloadContent::Verbose(args) = &message.payload {
                    if args.len() > 2 {
                        if let (Some(arg1), Some(arg2)) = (args.first(), args.last()) {
                            if Self::is_kind_of(FT_START_TAG, arg1, arg2) {
                                return Self::start_message(message.header.timestamp, args);
                            } else if Self::is_kind_of(FT_DATA_TAG, arg1, arg2) {
                                return Self::data_message(message.header.timestamp, args);
                            } else if Self::is_kind_of(FT_END_TAG, arg1, arg2) {
                                return Self::end_message(message.header.timestamp, args);
                            }
                        }
                    }
                }
            }
        }

        None
    }

    /// Returns weather both arguments contain given tag.
    fn is_kind_of(tag: &str, arg1: &Argument, arg2: &Argument) -> bool {
        if let Some(string1) = Self::get_string(arg1) {
            if let Some(string2) = Self::get_string(arg2) {
                return (string1 == tag) && (string2 == tag);
            }
        }

        false
    }

    /// Parses a DLT-FT start message from a DLT argument list, if any.
    ///
    /// # Expected arguments:
    ///
    /// * 0 DLT_STRING("FLST")
    /// * 1 DLT_UINT(file-id)
    /// * 2 DLT_STRING(file-name)
    /// * 3 DLT_UINT(file-size)
    /// * 4 DLT_STRING(date-created)
    /// * 5 DLT_UINT(packets-count)
    /// * 6 DLT_UINT(buffer-size)
    /// * 7 DLT_STRING("FLST")
    fn start_message(timestamp: Option<u32>, args: &[Argument]) -> Option<FtMessage> {
        let id;
        let name;
        let size;
        let created;
        let packets;

        if let Some(arg) = args.get(1) {
            if let Some(value) = Self::get_number(arg) {
                id = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        if let Some(arg) = args.get(2) {
            if let Some(value) = Self::get_string(arg) {
                name = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        if let Some(arg) = args.get(3) {
            if let Some(value) = Self::get_number(arg) {
                size = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        if let Some(arg) = args.get(4) {
            if let Some(value) = Self::get_string(arg) {
                created = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        if let Some(arg) = args.get(5) {
            if let Some(value) = Self::get_number(arg) {
                packets = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        Some(FtMessage::Start(FileStart {
            timestamp,
            id,
            name,
            size,
            created,
            packets,
        }))
    }

    /// Returns a DLT-FT data message from a DLT argument list, if any.
    ///
    /// # Expected arguments:
    ///
    /// * 0 DLT_STRING("FLDA")
    /// * 1 DLT_UINT(file-id)
    /// * 2 DLT_UINT(packet-num)
    /// * 3 DLT_RAW(bytes)
    /// * 4 DLT_STRING("FLDA")
    fn data_message(timestamp: Option<u32>, args: &[Argument]) -> Option<FtMessage> {
        let id;
        let packet;
        let bytes;

        if let Some(arg) = args.get(1) {
            if let Some(value) = Self::get_number(arg) {
                id = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        if let Some(arg) = args.get(2) {
            if let Some(value) = Self::get_number(arg) {
                packet = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        if let Some(arg) = args.get(3) {
            if let Some(value) = Self::get_bytes(arg) {
                bytes = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        Some(FtMessage::Data(FileData {
            timestamp,
            id,
            packet,
            bytes,
        }))
    }

    /// Returns a DLT-FT end message from a DLT argument list, if any.
    ///
    /// # Expected arguments:
    ///
    /// * 0 DLT_STRING("FLFI")
    /// * 1 DLT_UINT(file-id)
    /// * 2 DLT_STRING("FLFI")
    fn end_message(timestamp: Option<u32>, args: &[Argument]) -> Option<FtMessage> {
        let id;

        if let Some(arg) = args.get(1) {
            if let Some(value) = Self::get_number(arg) {
                id = value;
            } else {
                return None;
            }
        } else {
            return None;
        }

        Some(FtMessage::End(FileEnd { timestamp, id }))
    }

    /// Returns a string value from given argument, if any.
    fn get_string(arg: &Argument) -> Option<String> {
        if let Value::StringVal(value) = &arg.value {
            return Some(value.trim().to_string());
        }

        None
    }

    /// Returns a number value from given argument, if any.
    fn get_number(arg: &Argument) -> Option<u32> {
        if let Value::U32(value) = &arg.value {
            return Some(*value);
        }

        None
    }

    /// Returns a byte value from given argument, if any.
    fn get_bytes(arg: &Argument) -> Option<&Vec<u8>> {
        if let Value::Raw(value) = &arg.value {
            return Some(value);
        }

        None
    }
}

/// An indexed DLT-FT file.
#[derive(Debug, Clone)]
pub struct FtFile {
    /// The name of the file.
    pub name: String,
    /// The total size of the file.
    pub size: u32,
    /// The creation date of the file.
    pub created: String,
    /// The 1-based indexes of the original DLT messages.
    messages: Vec<usize>,
}

/// An indexer for DLT-FT files contained in a DLT trace.
#[derive(Debug)]
pub struct FtIndexer {
    files: HashMap<u32, FtFile>,
}

impl FtIndexer {
    /// Creates a new indexer.
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
        }
    }

    /// Returns a list of files contained in the DLT trace of the given path, if any.
    pub async fn index(
        self,
        input: &Path,
        filter: Option<DltFilterConfig>,
        with_storage_header: bool,
        cancel: CancellationToken,
    ) -> Option<Vec<FtFile>> {
        if let Ok(file) = File::open(input) {
            let reader = BufReader::new(&file);
            let source = BinaryByteSource::new(reader);

            return self
                .index_from_source(source, filter, with_storage_header, cancel)
                .await;
        }

        None
    }

    /// Returns a list of files contained in the DLT trace of the given byte source, if any.
    pub async fn index_from_source<R: Read + Seek + Sync + Send>(
        mut self,
        source: BinaryByteSource<R>,
        filter: Option<DltFilterConfig>,
        with_storage_header: bool,
        cancel: CancellationToken,
    ) -> Option<Vec<FtFile>> {
        let parser = DltParser::new(filter.map(|f| f.into()), None, with_storage_header);
        let mut producer = MessageProducer::new(parser, source, None);
        let stream = producer.as_stream();
        pin_mut!(stream);

        let mut index: usize = 0;
        let mut canceled = false;

        loop {
            tokio::select! {
                _ = cancel.cancelled() => {
                    debug!("ft-index canceled");
                    canceled = true;
                    break;
                }
                item = tokio_stream::StreamExt::next(&mut stream) => {
                    match item {
                        Some((_, item)) => {
                            index += 1;
                            if let MessageStreamItem::Item(item) = item {
                                self.process(index, &item.message);
                            }
                        }
                        _ => {
                            break;
                        }
                    }
                }
            }
        }

        if canceled {
            return None;
        }

        Some(self.into())
    }

    /// Converts the indexer to the resulting list of indexed files.
    fn into(self) -> Vec<FtFile> {
        let mut result: Vec<FtFile> = self.files.into_values().collect();
        result.sort_by(|d1, d2| d1.name.cmp(&d2.name));
        result
    }

    /// Processes the next DLT message of the trace.
    fn process(&mut self, index: usize, message: &Message) {
        if let Some(ft_message) = FtMessageParser::parse(message) {
            match ft_message {
                FtMessage::Start(ft_start) => {
                    self.files.insert(
                        ft_start.id,
                        FtFile {
                            name: ft_start.name.clone(),
                            size: ft_start.size,
                            created: ft_start.created,
                            messages: vec![index],
                        },
                    );
                }
                FtMessage::Data(ft_data) => {
                    if let Some(mut ft_file) = self.files.remove(&ft_data.id) {
                        ft_file.messages.push(index);
                        self.files.insert(ft_data.id, ft_file);
                    }
                }
                FtMessage::End(ft_end) => {
                    if let Some(mut ft_file) = self.files.remove(&ft_end.id) {
                        ft_file.messages.push(index);
                        self.files.insert(ft_end.id, ft_file);
                    }
                }
            }
        }
    }
}

impl Default for FtIndexer {
    fn default() -> Self {
        Self::new()
    }
}

/// A stream of a DLT-FT file.
#[derive(Debug, Clone)]
struct FtStream {
    path: PathBuf,
    size: u32,
    index: u32,
    bytes: u32,
}

impl FtStream {
    /// Answers if the stream is complete.
    fn is_complete(&self) -> bool {
        self.size == self.bytes
    }

    /// Updates state for number of received bytes.
    fn packet_received(&mut self, bytes: u32) {
        self.bytes += bytes;
        self.index += 1
    }

    /// Returns the next expected packet index.
    fn next_index(&self) -> u32 {
        self.index + 1
    }
}

/// A streamer for DLT-FT files contained in a DLT trace.
#[derive(Debug)]
pub struct FtStreamer {
    streams: HashMap<u32, FtStream>,
    output: PathBuf,
    errors: usize,
    bytes: usize,
}

impl FtStreamer {
    /// Creates a new streamer for the given output directory.
    pub fn new(output: PathBuf) -> Self {
        Self {
            streams: HashMap::new(),
            output,
            errors: 0,
            bytes: 0,
        }
    }

    /// Writes the files contained in the DLT trace of the given path, if any.
    pub async fn stream(
        &mut self,
        input: &Path,
        filter: Option<DltFilterConfig>,
        files: Option<Vec<&FtFile>>,
        with_storage_header: bool,
        cancel: CancellationToken,
    ) -> usize {
        if let Ok(file) = File::open(input) {
            let reader = BufReader::new(&file);
            let source = BinaryByteSource::new(reader);

            return self
                .stream_from_source(source, filter, files, with_storage_header, cancel)
                .await;
        }

        0
    }

    /// Writes the files contained in the DLT trace of the given byte source, if any.
    pub async fn stream_from_source<R: Read + Seek + Sync + Send>(
        &mut self,
        source: BinaryByteSource<R>,
        filter: Option<DltFilterConfig>,
        files: Option<Vec<&FtFile>>,
        with_storage_header: bool,
        cancel: CancellationToken,
    ) -> usize {
        self.streams.drain();
        self.errors = 0;
        self.bytes = 0;

        let mut indexes: Option<Vec<&usize>> = None;
        let mut index_min: usize = 0;
        let mut index_max: usize = 0;

        if let Some(ref files) = files {
            let mut messages: Vec<&usize> = files.iter().flat_map(|file| &file.messages).collect();
            messages.sort();
            messages.dedup();

            index_min = **messages.iter().min().unwrap_or(&&0);
            index_max = **messages.iter().max().unwrap_or(&&0);
            indexes = Some(messages);
        }

        let skipped = if index_min > 0 { index_min - 1 } else { 0 };

        let parser = DltParser::new(filter.map(|f| f.into()), None, with_storage_header);
        let mut producer = MessageProducer::new(parser, source, None);
        let stream = producer.as_stream().skip(skipped);
        pin_mut!(stream);

        let mut index: usize = skipped;
        let mut canceled = false;

        loop {
            tokio::select! {
                _ = cancel.cancelled() => {
                    debug!("ft-stream canceled");
                    canceled = true;
                    break;
                }
                item = tokio_stream::StreamExt::next(&mut stream) => {
                    match item {
                        Some((_, item)) => {
                            index += 1;
                            if let MessageStreamItem::Item(item) = item {
                                if let Some(ref indexes) = indexes {
                                    if index > index_max {
                                        break;
                                    } else if indexes.contains(&&index) {
                                        self.process(&item.message);
                                    }
                                } else {
                                    self.process(&item.message);
                                }
                            }
                        }
                        _ => {
                            break;
                        }
                    }
                }
            }
        }

        if canceled {
            return 0;
        }

        self.bytes
    }

    /// Answers if the streamer is completed without errors.
    pub fn is_complete(&self) -> bool {
        self.num_streams() == 0 && self.num_errors() == 0
    }

    /// Returns the number of active streams.
    pub fn num_streams(&self) -> usize {
        self.streams.len()
    }

    /// Returns the number of stream errors.
    pub fn num_errors(&self) -> usize {
        self.errors
    }

    /// Processes the next DLT message of the trace.
    fn process(&mut self, message: &Message) {
        if let Some(ft_message) = FtMessageParser::parse(message) {
            match ft_message {
                FtMessage::Start(ft_start) => {
                    let path = self.output.join(ft_start.save_name());
                    debug!("extract: {} ({} bytes)", path.display(), ft_start.size);
                    match File::create(path.clone()) {
                        Ok(_) => {
                            self.streams.insert(
                                ft_start.id,
                                FtStream {
                                    path,
                                    size: ft_start.size,
                                    index: 0,
                                    bytes: 0,
                                },
                            );
                        }
                        Err(error) => {
                            eprintln!("ft-start: failed to create {} ({})", path.display(), error);
                            self.errors += 1;
                        }
                    };
                }
                FtMessage::Data(ft_data) => {
                    if let Some(mut ft_stream) = self.streams.remove(&ft_data.id) {
                        if ft_stream.next_index() == ft_data.packet {
                            match OpenOptions::new()
                                .write(true)
                                .append(true)
                                .open(ft_stream.path.clone())
                            {
                                Ok(mut file) => {
                                    match file.write_all(ft_data.bytes) {
                                        Ok(_) => {
                                            ft_stream.packet_received(ft_data.bytes.len() as u32);
                                            self.streams.insert(ft_data.id, ft_stream);
                                        }
                                        Err(error) => {
                                            eprintln!(
                                                "ft-data: failed to append {} ({})",
                                                ft_stream.path.display(),
                                                error
                                            );
                                            self.errors += 1;
                                        }
                                    };
                                }
                                Err(error) => {
                                    eprintln!(
                                        "ft-data: failed to open {} ({})",
                                        ft_stream.path.display(),
                                        error
                                    );
                                    self.errors += 1;
                                }
                            }
                        } else {
                            eprintln!(
                                "ft-data: packet mismatch (expected: {}, got: {}) for {}",
                                ft_stream.next_index(),
                                ft_data.packet,
                                ft_stream.path.display()
                            );
                            self.errors += 1;
                        }
                    }
                }
                FtMessage::End(ft_end) => {
                    if let Some(ft_stream) = self.streams.remove(&ft_end.id) {
                        if ft_stream.is_complete() {
                            self.bytes += ft_stream.bytes as usize;
                        } else {
                            eprintln!(
                                "ft-end: invalid size (expected: {}, got: {}) for {}",
                                ft_stream.size,
                                ft_stream.bytes,
                                ft_stream.path.display()
                            );
                            self.errors += 1;
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dlt_core::dlt::*;
    use rand::Rng;
    use std::{env, fs, io::Cursor};

    const CHUNK_SIZE: usize = 10;

    fn ft_files() -> (Vec<u32>, Vec<Message>) {
        let (id1, mut messages1) =
            ft_file("ecu1", "test1.txt", &String::from("test1").into_bytes());
        assert_eq!(3, messages1.len());
        let (id2, mut messages2) =
            ft_file("ecu2", "test2.txt", &String::from("test22").into_bytes());
        assert_eq!(3, messages2.len());
        let (id3, mut messages3) =
            ft_file("ecu3", "test3.txt", &String::from("test333").into_bytes());
        assert_eq!(3, messages3.len());

        let mut messages: Vec<Message> = Vec::new();
        messages.push(messages1.remove(0)); // 1
        messages.push(messages2.remove(0)); // 2
        messages.push(messages1.remove(0)); // 3
        messages.push(messages2.remove(0)); // 4
        messages.push(messages3.remove(0)); // 5
        messages.push(messages3.remove(0)); // 6
        messages.push(messages1.remove(0)); // 7
        messages.push(messages2.remove(0)); // 8
        messages.push(messages3.remove(0)); // 9

        (vec![id1, id2, id3], messages)
    }

    fn ft_file<'a>(ecu: &str, name: &str, payload: &'a [u8]) -> (u32, Vec<Message>) {
        let mut rand = rand::thread_rng();
        let id: u32 = rand.gen::<u32>();

        let size: usize = payload.len();
        let mut packets: usize = size / CHUNK_SIZE;
        if size % CHUNK_SIZE != 0 {
            packets += 1;
        }

        let mut messages: Vec<Message> = Vec::new();
        messages.push(start_message(
            ecu,
            FileStart {
                timestamp: None,
                id,
                name: name.to_string(),
                size: size.try_into().unwrap(),
                created: String::from("date"),
                packets: packets.try_into().unwrap(),
            },
        ));

        let mut offset: usize = 0;
        for packet in 1..(packets + 1) {
            let mut bytes: Vec<u8> = Vec::new();
            let bytes_left: usize = size - offset;
            if bytes_left > CHUNK_SIZE {
                bytes.append(&mut payload[offset..offset + CHUNK_SIZE].to_vec());
                offset += CHUNK_SIZE;
            } else {
                bytes.append(&mut payload[offset..offset + bytes_left].to_vec());
                offset += bytes_left;
            }

            messages.push(data_message(
                ecu,
                FileData {
                    timestamp: None,
                    id,
                    packet: packet.try_into().unwrap(),
                    bytes: &bytes,
                },
            ));
        }

        messages.push(end_message(
            ecu,
            FileEnd {
                timestamp: None,
                id,
            },
        ));
        (id, messages)
    }

    fn start_message(ecu: &str, config: FileStart) -> Message {
        let args: Vec<Argument> = vec![
            arg_string(FT_START_TAG.to_string()),
            arg_number(config.id),
            arg_string(config.name),
            arg_number(config.size),
            arg_string(config.created),
            arg_number(config.packets),
            arg_number(0), // buffer-size
            arg_string(FT_START_TAG.to_string()),
        ];
        dlt_message(ecu, args)
    }

    fn data_message(ecu: &str, config: FileData) -> Message {
        let args: Vec<Argument> = vec![
            arg_string(FT_DATA_TAG.to_string()),
            arg_number(config.id),
            arg_number(config.packet),
            arg_bytes(config.bytes.to_vec()),
            arg_string(FT_DATA_TAG.to_string()),
        ];
        dlt_message(ecu, args)
    }

    fn end_message(ecu: &str, config: FileEnd) -> Message {
        let args: Vec<Argument> = vec![
            arg_string(FT_END_TAG.to_string()),
            arg_number(config.id),
            arg_string(FT_END_TAG.to_string()),
        ];
        dlt_message(ecu, args)
    }

    fn dlt_message(ecu: &str, args: Vec<Argument>) -> Message {
        let mut payload_length: u16 = 0;
        for arg in args.iter() {
            payload_length += arg.len() as u16;
        }
        Message {
            storage_header: None,
            header: StandardHeader {
                version: 0,
                endianness: Endianness::Big,
                has_extended_header: true,
                message_counter: 0,
                ecu_id: Some(ecu.to_string()),
                session_id: None,
                timestamp: None,
                payload_length,
            },
            extended_header: Some(ExtendedHeader {
                verbose: true,
                argument_count: args.len() as u8,
                message_type: MessageType::Log(LogLevel::Info),
                application_id: String::from(""),
                context_id: String::from(""),
            }),
            payload: PayloadContent::Verbose(args),
        }
    }

    fn arg_string(value: String) -> Argument {
        Argument {
            type_info: TypeInfo {
                kind: TypeInfoKind::StringType,
                coding: StringCoding::UTF8,
                has_variable_info: false,
                has_trace_info: false,
            },
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::StringVal(value),
        }
    }

    fn arg_number(value: u32) -> Argument {
        Argument {
            type_info: TypeInfo {
                kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
                coding: StringCoding::UTF8,
                has_variable_info: false,
                has_trace_info: false,
            },
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::U32(value),
        }
    }

    fn arg_bytes(value: Vec<u8>) -> Argument {
        Argument {
            type_info: TypeInfo {
                kind: TypeInfoKind::Raw,
                coding: StringCoding::UTF8,
                has_variable_info: false,
                has_trace_info: false,
            },
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::Raw(value),
        }
    }

    fn as_bytes(messages: &Vec<Message>) -> Vec<u8> {
        let mut bytes: Vec<u8> = Vec::new();
        for message in messages.iter() {
            bytes.append(&mut message.as_bytes());
        }
        bytes
    }

    /// A temporary directory with lock scope.
    struct TempDir {
        dir: PathBuf,
    }

    impl TempDir {
        fn new() -> Self {
            let mut rand = rand::thread_rng();
            let dir = env::current_dir()
                .unwrap()
                .join(format!("temp_{}", rand.gen::<u64>()));
            fs::create_dir(dir.clone()).unwrap();
            TempDir { dir }
        }

        fn assert_file(&self, name: &str, content: &str) {
            let path = self.dir.join(name);
            let string = fs::read_to_string(path).unwrap();
            assert_eq!(string, content);
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            fs::remove_dir_all(self.dir.clone()).unwrap();
        }
    }

    async fn index(
        indexer: FtIndexer,
        messages: &Vec<Message>,
        filter: Option<DltFilterConfig>,
        canceled: bool,
    ) -> Option<Vec<FtFile>> {
        let cursor = Cursor::new(as_bytes(&messages));
        let source = BinaryByteSource::new(cursor);
        let cancel = CancellationToken::new();
        if canceled {
            cancel.cancel();
        }
        indexer
            .index_from_source(source, filter, false, cancel)
            .await
    }

    async fn stream(
        streamer: &mut FtStreamer,
        messages: &Vec<Message>,
        filter: Option<DltFilterConfig>,
        files: Option<Vec<&FtFile>>,
        canceled: bool,
    ) -> usize {
        let cursor = Cursor::new(as_bytes(&messages));
        let source = BinaryByteSource::new(cursor);
        let cancel = CancellationToken::new();
        if canceled {
            cancel.cancel();
        }
        streamer
            .stream_from_source(source, filter, files, false, cancel)
            .await
    }

    #[test]
    fn test_parse_ft_messages() {
        let (id, messages) = ft_file("ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());

        assert_eq!(
            Some(FtMessage::Start(FileStart {
                timestamp: None,
                id,
                name: String::from("test.txt"),
                size: 4,
                created: String::from("date"),
                packets: 1,
            })),
            FtMessageParser::parse(messages.get(0).unwrap())
        );

        assert_eq!(
            Some(FtMessage::Data(FileData {
                timestamp: None,
                id,
                packet: 1,
                bytes: &"test".as_bytes().to_vec(),
            })),
            FtMessageParser::parse(messages.get(1).unwrap())
        );

        assert_eq!(
            Some(FtMessage::End(FileEnd {
                timestamp: None,
                id
            })),
            FtMessageParser::parse(messages.get(2).unwrap())
        );
    }

    #[test]
    fn test_ft_name() {
        let mut file = FileStart {
            timestamp: Some(123),
            id: 321,
            name: String::from("test.txt"),
            size: 4,
            created: String::from("date"),
            packets: 1,
        };
        assert_eq!(file.save_name(), String::from("123_test.txt"));

        file.timestamp = None;
        assert_eq!(file.save_name(), String::from("321_test.txt"))
    }

    #[tokio::test]
    async fn test_index_single_file() {
        let (_, messages) = ft_file("ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());

        let indexer = FtIndexer::new();
        let index = index(indexer, &messages, None, false).await.unwrap();
        assert_eq!(1, index.len());

        let file = index.get(0).unwrap();
        assert_eq!(file.name, String::from("test.txt"));
        assert_eq!(file.created, String::from("date"));
        assert_eq!(file.size, 4);
        assert_eq!(file.messages, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn test_index_single_file_multiple_chunks() {
        let (_, messages) = ft_file("ecu", "test.txt", "abcdefghijklmnopqrstuvwxyz".as_bytes());
        assert_eq!(5, messages.len());

        let indexer = FtIndexer::new();
        let index = index(indexer, &messages, None, false).await.unwrap();
        assert_eq!(1, index.len());

        let file = index.get(0).unwrap();
        assert_eq!(file.name, String::from("test.txt"));
        assert_eq!(file.created, String::from("date"));
        assert_eq!(file.size, 26);
        assert_eq!(file.messages, vec![1, 2, 3, 4, 5]);
    }

    #[tokio::test]
    async fn test_index_multiple_files() {
        let (_, messages) = ft_files();

        let indexer = FtIndexer::new();
        let index = index(indexer, &messages, None, false).await.unwrap();
        assert_eq!(3, index.len());

        let file = index.get(0).unwrap();
        assert_eq!(file.name, String::from("test1.txt"));
        assert_eq!(file.messages, vec![1, 3, 7]);

        let file = index.get(1).unwrap();
        assert_eq!(file.name, String::from("test2.txt"));
        assert_eq!(file.messages, vec![2, 4, 8]);

        let file = index.get(2).unwrap();
        assert_eq!(file.name, String::from("test3.txt"));
        assert_eq!(file.messages, vec![5, 6, 9]);
    }

    #[tokio::test]
    async fn test_index_files_with_filter() {
        let (_, messages) = ft_files();

        let indexer = FtIndexer::new();
        let filter = DltFilterConfig {
            min_log_level: None,
            app_ids: None,
            ecu_ids: Some(vec!["ecu2".to_string()]),
            context_ids: None,
            app_id_count: 0,
            context_id_count: 0,
        };
        let index = index(indexer, &messages, Some(filter), false)
            .await
            .unwrap();
        assert_eq!(1, index.len());

        let file = index.get(0).unwrap();
        assert_eq!(file.name, String::from("test2.txt"));
        assert_eq!(file.messages, vec![2, 4, 8]);
    }

    #[tokio::test]
    async fn test_index_canceled() {
        let (_, messages) = ft_files();

        let indexer = FtIndexer::new();
        let index = index(indexer, &messages, None, true).await;
        assert!(index.is_none());
    }

    #[tokio::test]
    async fn test_stream_single_file() {
        let output = TempDir::new();

        let (id, messages) = ft_file("ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(4, size);
        assert!(streamer.is_complete());

        output.assert_file(&format!("{}_test.txt", id), "test");
    }

    #[tokio::test]
    async fn test_stream_single_file_multiple_chunks() {
        let output = TempDir::new();

        let (id, messages) = ft_file("ecu", "test.txt", "abcdefghijklmnopqrstuvwxyz".as_bytes());
        assert_eq!(5, messages.len());

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(26, size);
        assert!(streamer.is_complete());

        output.assert_file(&format!("{}_test.txt", id), "abcdefghijklmnopqrstuvwxyz");
    }

    #[tokio::test]
    async fn test_stream_multiple_files() {
        let output = TempDir::new();

        let (ids, messages) = ft_files();
        assert_eq!(3, ids.len());

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(5 + 6 + 7, size);
        assert!(streamer.is_complete());

        output.assert_file(&format!("{}_test1.txt", ids.get(0).unwrap()), "test1");
        output.assert_file(&format!("{}_test2.txt", ids.get(1).unwrap()), "test22");
        output.assert_file(&format!("{}_test3.txt", ids.get(2).unwrap()), "test333");
    }

    #[tokio::test]
    async fn test_stream_files_with_filter() {
        let output = TempDir::new();

        let (ids, messages) = ft_files();
        assert_eq!(3, ids.len());

        let mut streamer = FtStreamer::new(output.dir.clone());
        let filter = DltFilterConfig {
            min_log_level: None,
            app_ids: None,
            ecu_ids: Some(vec!["ecu2".to_string()]),
            context_ids: None,
            app_id_count: 0,
            context_id_count: 0,
        };
        let size = stream(&mut streamer, &messages, Some(filter), None, false).await;
        assert_eq!(6, size);
        assert!(streamer.is_complete());

        output.assert_file(&format!("{}_test2.txt", ids.get(1).unwrap()), "test22");
    }

    #[tokio::test]
    async fn test_stream_files_with_index() {
        let (ids, messages) = ft_files();
        assert_eq!(3, ids.len());

        let indexer = FtIndexer::new();
        let index = index(indexer, &messages, None, false).await.unwrap();
        assert_eq!(3, index.len());

        {
            // file at start
            let output = TempDir::new();

            let mut files = Vec::new();
            files.push(index.get(0).unwrap());

            let mut streamer = FtStreamer::new(output.dir.clone());
            let size = stream(&mut streamer, &messages, None, Some(files), false).await;
            assert_eq!(5, size);
            assert!(streamer.is_complete());

            output.assert_file(&format!("{}_test1.txt", ids.get(0).unwrap()), "test1");
        }

        {
            // file in middle
            let output = TempDir::new();

            let mut files = Vec::new();
            files.push(index.get(1).unwrap());

            let mut streamer = FtStreamer::new(output.dir.clone());
            let size = stream(&mut streamer, &messages, None, Some(files), false).await;
            assert_eq!(6, size);
            assert!(streamer.is_complete());

            output.assert_file(&format!("{}_test2.txt", ids.get(1).unwrap()), "test22");
        }

        {
            // file at end
            let output = TempDir::new();

            let mut files = Vec::new();
            files.push(index.get(2).unwrap());

            let mut streamer = FtStreamer::new(output.dir.clone());
            let size = stream(&mut streamer, &messages, None, Some(files), false).await;
            assert_eq!(7, size);
            assert!(streamer.is_complete());

            output.assert_file(&format!("{}_test3.txt", ids.get(2).unwrap()), "test333");
        }

        {
            // all files
            let output = TempDir::new();

            let mut files = Vec::new();
            files.push(index.get(0).unwrap());
            files.push(index.get(1).unwrap());
            files.push(index.get(2).unwrap());

            let mut streamer = FtStreamer::new(output.dir.clone());
            let size = stream(&mut streamer, &messages, None, Some(files), false).await;
            assert_eq!(5 + 6 + 7, size);
            assert!(streamer.is_complete());

            output.assert_file(&format!("{}_test1.txt", ids.get(0).unwrap()), "test1");
            output.assert_file(&format!("{}_test2.txt", ids.get(1).unwrap()), "test22");
            output.assert_file(&format!("{}_test3.txt", ids.get(2).unwrap()), "test333");
        }
    }

    #[tokio::test]
    async fn test_stream_missing_data_packet() {
        let output = TempDir::new();

        let (id, mut messages) =
            ft_file("ecu", "test.txt", "abcdefghijklmnopqrstuvwxyz".as_bytes());
        assert_eq!(5, messages.len());
        messages.remove(3);

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(0, size);

        assert!(!streamer.is_complete());
        assert_eq!(0, streamer.num_streams());
        assert_eq!(1, streamer.num_errors());

        output.assert_file(&format!("{}_test.txt", id), "abcdefghijklmnopqrst");
    }

    #[tokio::test]
    async fn test_stream_mismatched_data_packet() {
        let output = TempDir::new();

        let (id, mut messages) =
            ft_file("ecu", "test.txt", "abcdefghijklmnopqrstuvwxyz".as_bytes());
        assert_eq!(5, messages.len());
        messages.swap(2, 3);

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(0, size);

        assert!(!streamer.is_complete());
        assert_eq!(0, streamer.num_streams());
        assert_eq!(1, streamer.num_errors());

        output.assert_file(&format!("{}_test.txt", id), "abcdefghij");
    }

    #[tokio::test]
    async fn test_stream_missing_end_packet() {
        let output = TempDir::new();

        let (id, mut messages) =
            ft_file("ecu", "test.txt", "abcdefghijklmnopqrstuvwxyz".as_bytes());
        assert_eq!(5, messages.len());
        messages.remove(4);

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(0, size);

        assert!(!streamer.is_complete());
        assert_eq!(1, streamer.num_streams());
        assert_eq!(0, streamer.num_errors());

        output.assert_file(&format!("{}_test.txt", id), "abcdefghijklmnopqrstuvwxyz");
    }

    #[tokio::test]
    async fn test_stream_io_error() {
        let (_, messages) = ft_file("ecu", "test.txt", "abcdefghijklmnopqrstuvwxyz".as_bytes());
        assert_eq!(5, messages.len());

        let mut streamer;
        {
            let output = TempDir::new(); // scoped!
            streamer = FtStreamer::new(output.dir.clone());
        }
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(0, size);

        assert!(!streamer.is_complete());
        assert_eq!(0, streamer.num_streams());
        assert_eq!(1, streamer.num_errors());
    }

    #[tokio::test]
    async fn test_stream_clears_state_on_rerun() {
        let output = TempDir::new();
        let mut streamer = FtStreamer::new(output.dir.clone());

        let (id, mut messages) = ft_file("ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());
        messages.remove(1);
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(0, size);
        assert!(!streamer.is_complete());
        assert_eq!(0, streamer.num_streams());
        assert_eq!(1, streamer.num_errors());
        output.assert_file(&format!("{}_test.txt", id), "");

        let (id, mut messages) = ft_file("ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());
        messages.remove(2);
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(0, size);
        assert!(!streamer.is_complete());
        assert_eq!(1, streamer.num_streams());
        assert_eq!(0, streamer.num_errors());
        output.assert_file(&format!("{}_test.txt", id), "test");

        let (id, messages) = ft_file("ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());
        let size = stream(&mut streamer, &messages, None, None, false).await;
        assert_eq!(4, size);
        assert!(streamer.is_complete());
        output.assert_file(&format!("{}_test.txt", id), "test");
    }

    #[tokio::test]
    async fn test_stream_canceled() {
        let output = TempDir::new();
        let (_, messages) = ft_files();

        let mut streamer = FtStreamer::new(output.dir.clone());
        let size = stream(&mut streamer, &messages, None, None, true).await;
        assert_eq!(0, size);
    }
}
