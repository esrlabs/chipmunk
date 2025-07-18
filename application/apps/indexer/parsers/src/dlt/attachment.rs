use dlt_core::dlt::{Argument, LogLevel, Message, MessageType, PayloadContent, Value};
use std::{collections::HashMap, path::PathBuf};

use crate::*;

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
        if let MessageType::Log(LogLevel::Info) = message.extended_header.as_ref()?.message_type {
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
        Some(FtMessage::Start(FileStart {
            timestamp,
            id: Self::get_number(args.get(1)?)?,
            name: Self::get_string(args.get(2)?)?,
            size: Self::get_number(args.get(3)?)?,
            created: Self::get_string(args.get(4)?)?,
            packets: Self::get_number(args.get(5)?)?,
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

/// An scanner for DLT-FT files contained in a DLT trace.
#[derive(Debug)]
pub struct FtScanner {
    files: HashMap<u32, Attachment>,
    index: usize,
}

impl FtScanner {
    /// Creates a new scanner.
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
            index: 0,
        }
    }
}

impl FtScanner {
    /// Processes the next DLT message of the trace.
    ///
    /// # Arguments
    ///
    /// * `message` - The message to be processed.
    pub fn process(&mut self, message: &Message) -> Option<Attachment> {
        let result = if let Some(ft_message) = FtMessageParser::parse(message) {
            match ft_message {
                FtMessage::Start(ft_start) => {
                    self.files.insert(
                        ft_start.id,
                        Attachment {
                            name: ft_start.name.clone(),
                            size: ft_start.size as usize,
                            created_date: Some(ft_start.created),
                            modified_date: None,
                            messages: vec![self.index],
                            data: Vec::new(),
                        },
                    );
                    None
                }
                FtMessage::Data(ft_data) => {
                    if let Some(mut ft_file) = self.files.remove(&ft_data.id) {
                        ft_file.messages.push(self.index);
                        ft_file.add_data(ft_data.bytes);
                        self.files.insert(ft_data.id, ft_file);
                    }
                    None
                }
                FtMessage::End(ft_end) => {
                    if let Some(mut ft_file) = self.files.remove(&ft_end.id) {
                        ft_file.messages.push(self.index);
                        Some(ft_file)
                    } else {
                        None
                    }
                }
            }
        } else {
            None
        };
        self.index += 1;
        result
    }
}

impl Default for FtScanner {
    fn default() -> Self {
        Self::new()
    }
}

/// An extractor for data chunks contained in a file.
pub struct FileExtractor;

impl FileExtractor {
    /// Returns the list of files with their file-system save names.
    pub fn files_with_names(files: Vec<Attachment>) -> Vec<(Attachment, String)> {
        let names: Vec<String> = files
            .iter()
            .map(|f| FileExtractor::file_name(&f.name))
            .collect();
        std::iter::zip(files, (0..names.len()).map(|i| names[i].to_string())).collect()
    }

    /// Returns the list of files with their file-system save names prefixed.
    pub fn files_with_names_prefixed(files: Vec<Attachment>) -> Vec<(Attachment, String)> {
        let names: Vec<String> = files
            .iter()
            .map(|f| FileExtractor::file_name(&f.name))
            .collect();
        std::iter::zip(
            files,
            (0..names.len()).map(|i| format!("{:0>8}_{}", i, names[i])),
        )
        .collect()
    }

    /// Returns a file-system save name.
    pub fn file_name(name: &str) -> String {
        name.replace(['\\', '/'], "$").replace(' ', "_")
    }
}

pub struct TempDir {
    pub dir: PathBuf,
}

impl TempDir {
    pub fn new() -> Self {
        use rand::Rng;
        use std::{env, fs};
        let mut rand = rand::rng();
        let dir = env::current_dir()
            .unwrap()
            .join(format!("temp_{}", rand.random::<u64>()));
        fs::create_dir(dir.clone()).unwrap();
        TempDir { dir }
    }

    pub fn assert_file(&self, name: &str, content: &str) {
        let path = self.dir.join(name);
        let string =
            std::fs::read_to_string(&path).unwrap_or_else(|_| panic!("{:?} should exist", &path));
        assert_eq!(string, content);
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        std::fs::remove_dir_all(self.dir.clone()).unwrap();
    }
}

impl Default for TempDir {
    fn default() -> Self {
        Self::new()
    }
}

#[allow(clippy::get_first)]
#[cfg(test)]
pub mod tests {

    use std::{fs::File, io::Write};

    use super::*;
    use dlt_core::dlt::*;

    const DLT_HEADER_SIZE: usize = 16;
    const DLT_FT_CHUNK_SIZE: usize = 10;

    #[allow(clippy::vec_init_then_push)]
    fn ft_files() -> Vec<Message> {
        let mut messages1 = ft_file(42, "ecu1", "test1.txt", &String::from("test1").into_bytes());
        assert_eq!(3, messages1.len());
        let mut messages2 = ft_file(
            43,
            "ecu2",
            "test2.txt",
            &String::from("test22").into_bytes(),
        );
        assert_eq!(3, messages2.len());
        let mut messages3 = ft_file(
            44,
            "ecu3",
            "test3.txt",
            &String::from("test333").into_bytes(),
        );
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

        messages
    }

    fn ft_file(id: u32, ecu: &str, name: &str, payload: &[u8]) -> Vec<Message> {
        let size: usize = payload.len();
        let mut packets: usize = size / DLT_FT_CHUNK_SIZE;
        if size % DLT_FT_CHUNK_SIZE != 0 {
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
            if bytes_left > DLT_FT_CHUNK_SIZE {
                bytes.append(&mut payload[offset..offset + DLT_FT_CHUNK_SIZE].to_vec());
                offset += DLT_FT_CHUNK_SIZE;
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
        messages
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

    fn write_dlt_file(output: PathBuf, messages: &[Message]) {
        let mut file = File::create(output).unwrap();

        let header: [u8; DLT_HEADER_SIZE] = [
            0x44, 0x4C, 0x54, 0x01, // dlt-pattern
            0x00, 0x00, 0x00, 0x00, // timestamp
            0x00, 0x00, 0x00, 0x00, //
            0x65, 0x63, 0x75, 0x00, // ecu-id
        ];
        for message in messages {
            file.write_all(&header).unwrap();
            file.write_all(&message.as_bytes()).unwrap();
        }
    }

    fn scan_messages(messages: &[Message]) -> Vec<Attachment> {
        let mut scanner = FtScanner::new();
        let mut result_vec = vec![];
        for message in messages {
            if let Some(attachment) = scanner.process(message) {
                result_vec.push(attachment);
            }
        }
        result_vec
    }

    #[test]
    fn test_parse_messages() {
        let messages = ft_file(42, "ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());

        assert_eq!(
            Some(FtMessage::Start(FileStart {
                timestamp: None,
                id: 42,
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
                id: 42,
                packet: 1,
                bytes: &"test".as_bytes().to_vec(),
            })),
            FtMessageParser::parse(messages.get(1).unwrap())
        );

        assert_eq!(
            Some(FtMessage::End(FileEnd {
                timestamp: None,
                id: 42
            })),
            FtMessageParser::parse(messages.get(2).unwrap())
        );
    }

    #[test]
    fn test_scan_file() {
        let messages = ft_file(42, "ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());

        let index = scan_messages(&messages);
        assert_eq!(1, index.len());

        let file = index.get(0).unwrap();
        assert!(file.created_date.is_some());
        assert_eq!(file.name, String::from("test.txt"));
        assert_eq!(file.size, 4);
        assert_eq!(file.messages, vec![0, 1, 2]);
        assert_eq!(file.data, vec![0x74, 0x65, 0x73, 0x74]);
    }

    #[test]
    fn test_scan_file_with_multiple_chunks() {
        let messages = ft_file(
            42,
            "ecu",
            "test.txt",
            "abcdefghijklmnopqrstuvwxyz".as_bytes(),
        );
        assert_eq!(5, messages.len());

        let index = scan_messages(&messages);
        assert_eq!(1, index.len());

        let file = index.get(0).unwrap();
        assert_eq!(file.name, String::from("test.txt"));
        assert_eq!(file.size, 26);
        assert_eq!(file.messages, vec![0, 1, 2, 3, 4]);
        assert_eq!(
            file.data,
            vec![
                0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e,
                0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a
            ]
        );
    }

    #[test]
    fn test_scan_files() {
        let messages = ft_files();
        assert_eq!(9, messages.len());

        let index = scan_messages(&messages);
        assert_eq!(3, index.len());

        let file = index.get(0).unwrap();
        assert!(file.created_date.is_some());
        assert_eq!(file.name, String::from("test1.txt"));
        assert_eq!(file.size, 5);
        assert_eq!(file.messages, vec![0, 2, 6]);
        assert_eq!(file.data, vec![0x74, 0x65, 0x73, 0x74, 0x31]);

        let file = index.get(1).unwrap();
        assert!(file.created_date.is_some());
        assert_eq!(file.name, String::from("test2.txt"));
        assert_eq!(file.size, 6);
        assert_eq!(file.messages, vec![1, 3, 7]);
        assert_eq!(file.data, vec![0x74, 0x65, 0x73, 0x74, 0x32, 0x32]);

        let file = index.get(2).unwrap();
        assert!(file.created_date.is_some());
        assert_eq!(file.name, String::from("test3.txt"));
        assert_eq!(file.size, 7);
        assert_eq!(file.messages, vec![4, 5, 8]);
        assert_eq!(file.data, vec![0x74, 0x65, 0x73, 0x74, 0x33, 0x33, 0x33]);
    }

    #[test]
    fn test_extract_file() {
        let output = TempDir::new();

        let messages = ft_file(42, "ecu", "test.txt", "test".as_bytes());
        assert_eq!(3, messages.len());

        let dlt = output.dir.join("sample.dlt");
        write_dlt_file(dlt, &messages);

        let file = Attachment {
            name: "test.txt".to_string(),
            size: 4,
            created_date: Some("date".to_string()),
            modified_date: None,
            messages: vec![0, 1, 2],
            data: vec![0x74, 0x65, 0x73, 0x74],
        };

        let size = file.data.len();
        assert_eq!(file.size, size);
    }

    #[test]
    fn test_extract_file_with_multiple_chunks() {
        let output = TempDir::new();

        let messages = ft_file(
            42,
            "ecu",
            "test.txt",
            "abcdefghijklmnopqrstuvwxyz".as_bytes(),
        );
        assert_eq!(5, messages.len());

        let dlt = output.dir.join("sample.dlt");
        write_dlt_file(dlt, &messages);

        let file = Attachment {
            name: "test.txt".to_string(),
            size: 26,
            created_date: Some("date".to_string()),
            modified_date: None,
            messages: vec![0, 1, 2, 3, 4],
            data: vec![
                0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e,
                0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a,
            ],
        };

        let size = file.data.len();
        assert_eq!(file.size, size);
    }

    #[test]
    fn test_file_name() {
        assert_eq!(
            FileExtractor::file_name("\\dir/foo bar.txt"),
            String::from("$dir$foo_bar.txt")
        );
    }

    #[test]
    fn test_files_with_names() {
        let index = scan_messages(&ft_files());
        assert_eq!(3, index.len());

        let files = FileExtractor::files_with_names(index);
        assert_eq!(files[0].0.name, "test1.txt");
        assert_eq!(files[0].1, "test1.txt");
        assert_eq!(files[1].0.name, "test2.txt");
        assert_eq!(files[1].1, "test2.txt");
        assert_eq!(files[2].0.name, "test3.txt");
        assert_eq!(files[2].1, "test3.txt");
    }

    #[test]
    fn test_files_with_names_prefixed() {
        let index = scan_messages(&ft_files());
        assert_eq!(3, index.len());

        let files = FileExtractor::files_with_names_prefixed(index);
        assert_eq!(files[0].0.name, "test1.txt");
        assert_eq!(files[0].1, "00000000_test1.txt");
        assert_eq!(files[1].0.name, "test2.txt");
        assert_eq!(files[1].1, "00000001_test2.txt");
        assert_eq!(files[2].0.name, "test3.txt");
        assert_eq!(files[2].1, "00000002_test3.txt");
    }
}
