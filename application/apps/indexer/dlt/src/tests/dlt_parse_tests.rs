#[cfg(test)]
mod tests {
    use crate::dlt_parse::*;
    use crate::dlt::*;
    use crate::proptest_strategies::*;
    use std::io::Write;
    use crossbeam_channel as cc;
    use nom::IResult;
    use proptest::prelude::*;
    use dirs;
    use indexer_base::chunks::{Chunk, ChunkResults};
    use indexer_base::config::IndexingConfig;

    use byteorder::{BigEndian, LittleEndian};
    use bytes::BytesMut;
    use pretty_assertions::assert_eq;
    use std::sync::Once;
    extern crate log;

    static INIT: Once = Once::new();

    fn init_logging() {
        INIT.call_once(|| {
            if std::env::var("RUST_LOG").is_err() {
                std::env::set_var("RUST_LOG", "error,dlt=error,dlt_parse_tests=error");
            }
            env_logger::init();
        });
    }
    #[test]
    fn test_dlt_message_parsing() {
        let mut raw1: Vec<u8> = vec![
            // storage header
            //0x44,
            0x4C, 0x54, 0x01, 0x56, 0xA2, 0x91, 0x5C, 0x9C, 0x91, 0x0B, 0x00, 0x45, 0x43, 0x55,
            0x31, // header
            0x3D, // header type 0b11 1101
            0x40, 0x00, 0xA2, 0x45, 0x43, 0x55, 0x31, // ecu id
            0x00, 0x00, 0x01, 0x7F, // session id
            0x00, 0x5B, 0xF7, 0x16, // timestamp
            // extended header
            0x51, // MSIN 0b101 0001 => verbose, MST log,
            0x06, // arg count
            0x56, 0x53, 0x6F, 0x6D, // app id VSom
            0x76, 0x73, 0x73, 0x64, // context id vssd
            // arguments
            // 0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
            // 0x3A, 0x00,
            // 0x5B, 0x33, 0x38, 0x33, 0x3A, 0x20, 0x53, 0x65,
            // 0x72, 0x76, 0x69, 0x63, 0x65, 0x44, 0x69, 0x73, 0x63, 0x6F, 0x76, 0x65, 0x72, 0x79,
            // 0x55, 0x64, 0x70, 0x45, 0x6E, 0x64, 0x70, 0x6F, 0x69, 0x6E, 0x74, 0x28, 0x31, 0x36,
            // 0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39, 0x39, 0x2E, 0x31, 0x30, 0x32, 0x3A, 0x35,
            // 0x30, 0x31, 0x35, 0x32, 0x29, 0x5D, 0x20, 0x00,
            0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
            0x0F, 0x00, // length
            0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x4D, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65,
            0x00, // "ProcessMessage"
            0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
            0x02, 0x00, // length
            0x3A, 0x00, // ":"
            0x23, 0x00, 0x00, 0x00, // type info 0b10000000001000010
            0x0D, 0x01, 0x00, 0x00, 0x00, 0x82, 0x00, 0x00, 0x03, 0x00, 0x3A, 0x20, 0x00, 0x00,
            0x82, 0x00, 0x00, 0x14, 0x00, 0x31, 0x36, 0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39,
            0x39, 0x2E, 0x31, 0x36, 0x2C, 0x33, 0x30, 0x35, 0x30, 0x31, 0x00,
        ];
        let raw2: Vec<u8> = vec![
            0x44, 0x4C, 0x54, 0x01, 0x56, 0xA2, 0x91, 0x5C, 0x9C, 0x91, 0x0B, 0x00, 0x45, 0x43,
            0x55, 0x31, 0x3D, 0x41, 0x00, 0xA9, 0x45, 0x43, 0x55, 0x31, 0x00, 0x00, 0x01, 0x7F,
            0x00, 0x5B, 0xF7, 0x16, 0x51, 0x09, 0x56, 0x53, 0x6F, 0x6D, 0x76, 0x73, 0x73, 0x64,
            0x00, 0x82, 0x00, 0x00, 0x3A, 0x00, 0x5B, 0x33, 0x38, 0x33, 0x3A, 0x20, 0x53, 0x65,
            0x72, 0x76, 0x69, 0x63, 0x65, 0x44, 0x69, 0x73, 0x63, 0x6F, 0x76, 0x65, 0x72, 0x79,
            0x55, 0x64, 0x70, 0x45, 0x6E, 0x64, 0x70, 0x6F, 0x69, 0x6E, 0x74, 0x28, 0x31, 0x36,
            0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39, 0x39, 0x2E, 0x31, 0x30, 0x32, 0x3A, 0x35,
            0x30, 0x31, 0x35, 0x32, 0x29, 0x5D, 0x20, 0x00, 0x00, 0x82, 0x00, 0x00, 0x0F, 0x00,
            0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x4D, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65,
            0x00, 0x00, 0x82, 0x00, 0x00, 0x02, 0x00, 0x3A, 0x00, 0x23, 0x00, 0x00, 0x00, 0x24,
            0x01, 0x00, 0x00, 0x00, 0x82, 0x00, 0x00, 0x06, 0x00, 0x3A, 0x20, 0x28, 0x30, 0x78,
            0x00, 0x42, 0x00, 0x01, 0x00, 0x36, 0x15, 0x00, 0x82, 0x00, 0x00, 0x04, 0x00, 0x2C,
            0x30, 0x78, 0x00, 0x42, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x82, 0x00, 0x00, 0x02,
            0x00, 0x29, 0x00,
        ];
        #[rustfmt::skip]
        let _raw3: Vec<u8> = vec![
            // storage header
            /* DLT + 0x01 */ 0x44, 0x4C, 0x54, 0x01,
            /* timestamp sec */ 0x90, 0xB8, 0xB3, 0x5D,
            /* timestamp ms */ 0x00, 0x00, 0x00, 0x00,
            /* ecu id "ECU" */ 0x45, 0x43, 0x55, 0x00,
            /* header-type       0b0010 1001 */ 0x29,
            /* extended header        | |||^ */
            /* MSBF: 0  little endian | ||^  */
            /* WEID: 0  no ecu id     | |^   */
            /* WSID: 1  sess id       | ^    */
            /* WTMS: 0 no timestamp   ^      */
            /* version nummber 1   ^^^       */
            /* message counter */ 0x20,
            /* length = 0 */ 0x00, 0x00,
            /* session id */ 0x02, 0x00, 0x00, 0x1C,
            /* extended header */ 0x00, 0x45, 0x6E, 0x64, 0x20, 0x65, 0x76, 0x65, 0x6E, 0x74];
        let _raw4: Vec<u8> = vec![
            // storage header
            /* DLT + 0x01 */ 0x44, 0x4C, 0x54, 0x01,
            /* timestamp sec = 0x5DB3B890 =  October 26, 2019 3:08:00 AM*/ 0x90, 0xB8, 0xB3,
            0x5D, /* timestamp ms */ 0x00, 0x00, 0x00, 0x00, /* ecu id "ECU" */ 0x45,
            0x43, 0x55, 0x00, /* header-type       0b0101 0011 */ 0x53,
            /* extended header        | |||^ */
            /* MSBF: 1  big endian    | ||^  */
            /* WEID: 0  no ecu id     | |^   */
            /* WSID: 0  no sess id    | ^    */
            /* WTMS: 1  timestamp     ^      */
            /* version nummber 2   ^^^       */
            /* message counter */
            0x44, /* length = 21327 */ 0x53, 0x4F,
            /* timestamp (ecu/session id missing) 139698662.4 = ~39h */ 0x53, 0x44, 0x53,
            0x00, /* extended header */ 0x02, 0x00, 0x00, 0x1D, 0x00, 0x5B, 0x50, 0x6F, 0x6C,
            0x6C,
            // message-info MSIN = 0x02 = 0b0000 0010
            // 0 = non-verbose              |||| |||^
            // 001 (MSTP) 0x1 Dlt AppTrace  |||| ^^^
            // 0000 (Type Info) = 0x0       ^^^^
            // number of arguments NOAR = 0x00
            // application id = 001D005B = "   ["
            // context id = 506F6C6C = "Poll"
            // ========================================
            // payload
            0x65, 0x72, 0x3A, 0x3A, 0x70, 0x6F, 0x6C, 0x6C, 0x5D, 0x20, 0x72,
        ];
        raw1.extend_from_slice(&raw2);
        let res1: IResult<&[u8], Option<Message>> =
            dlt_message(&raw1[..], None, 0, 0, None, None, true);
        trace!("res1 was: {:?}", res1);
        // let res2: IResult<&[u8], Option<Message>> = dlt_message(&raw2[..], None, 0, 0);
        // trace!("res was: {:?}", res2);
    }
    static VALID_ECU_ID_FORMAT: &str = "[0-9a-zA-Z]{4}";
    proptest! {
        #[test]
        fn parse_ecu_id_doesnt_crash(s in "\\PC*") {
            let _ = parse_ecu_id(s.as_bytes());
        }
        #[test]
        fn parses_all_valid_ecu_ids(s in VALID_ECU_ID_FORMAT) {
            parse_ecu_id(s.as_bytes()).unwrap();
        }
    }

    #[test]
    fn test_ecu_id_parser() {
        let expected: IResult<&[u8], &str> = Ok((&[], "ecu1"));
        assert_eq!(expected, parse_ecu_id(b"ecu1"));
        assert_eq!(
            Err(nom::Err::Incomplete(nom::Needed::Size(1))),
            parse_ecu_id(b"ecu")
        );
    }

    proptest! {
        #[test]
        fn test_dlt_all_storage_header(header_to_expect: StorageHeader) {
            trace!("header_to_expect: {}", header_to_expect);
            let mut header_bytes = header_to_expect.as_bytes();
            trace!("header bytes: {:02X?}", header_bytes);
            header_bytes.extend(b"----");
            let res: IResult<&[u8], Option<StorageHeader>> = dlt_storage_header::<Chunk>(&header_bytes, None, None);
            if let Ok((_, Some(v))) = res.clone() {
                trace!("parsed header: {}", v)
            }
            let expected: IResult<&[u8], Option<StorageHeader>> =
                Ok((b"----", Some(header_to_expect)));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_dlt_standard_header(header_to_expect in header_strategy(4, Endianness::Big)) {
            init_logging();
            let mut header_bytes = header_to_expect.header_as_bytes();
            header_bytes.extend(b"----");
            let res: IResult<&[u8], StandardHeader> = dlt_standard_header(&header_bytes);
            let expected: IResult<&[u8], StandardHeader> = Ok((b"----", header_to_expect));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_extended_header(header_to_expect: ExtendedHeader) {
            let mut header_bytes = header_to_expect.as_bytes();
            header_bytes.extend(b"----");
            let res: IResult<&[u8], ExtendedHeader> = dlt_extended_header::<Chunk>(&header_bytes, None, None);
            let expected: IResult<&[u8], ExtendedHeader> = Ok((b"----", header_to_expect));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_parse_type_info(type_info: TypeInfo) {
            let mut type_info_bytes = type_info.as_bytes::<BigEndian>();
            trace!("{:02X?}", type_info_bytes);
            type_info_bytes.extend(b"----");
            let res: IResult<&[u8], TypeInfo> = dlt_type_info::<BigEndian>(&type_info_bytes);
            let expected: IResult<&[u8], TypeInfo> = Ok((b"----", type_info));
            assert_eq!(expected, res);
        }
        #[test]

        fn test_parse_any_argument(argument in argument_strategy()) {
            let mut argument_bytes = argument.as_bytes::<BigEndian>();
            argument_bytes.extend(b"----");
            let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
            let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
            assert_eq!(expected, res);
        }
        #[test]
        fn test_argument_to_bytes_to_argument(arg in argument_strategy(), endianness in any::<Endianness>()) {
            init_logging();
            let mut arg_bytes = if endianness == Endianness::Big {
                arg.as_bytes::<BigEndian>()
            } else {
                arg.as_bytes::<LittleEndian>()
            };
            arg_bytes.extend(b"----");
            let expected: IResult<&[u8], Argument> = Ok((b"----", arg));
            if endianness == Endianness::Big {
                assert_eq!(expected, dlt_argument::<BigEndian>(&arg_bytes));
            } else {
                assert_eq!(expected, dlt_argument::<LittleEndian>(&arg_bytes));
            };
        }
        #[test]
        fn test_message_to_bytes_to_message(msg in message_strat()) {
            init_logging();
            // println!("msg: {:?}", serde_json::to_string(&msg));
            let mut msg_bytes = msg.as_bytes();
            // println!("msg bytes: {:02X?}", msg_bytes);
            msg_bytes.extend(b"----");
            // dump_to_file(&msg_bytes)?;
            let expected: IResult<&[u8], Option<Message>> = Ok((b"----", Some(msg)));
            assert_eq!(expected, dlt_message(&msg_bytes, None, 0, 0, None, None, false));
        }
    }
    fn dump_to_file(msg_bytes: &[u8]) -> std::io::Result<()> {
        let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
        let file_path = home_dir.join("testmsg.bin");
        let mut file = std::fs::File::create(file_path)?;
        file.write_all(&msg_bytes[..])
    }
    #[test]
    fn test_parse_msg() {
        init_logging();
        let payload = Payload2 {
            payload_content: PayloadContent::Verbose(vec![Argument {
                type_info: TypeInfo {
                    kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
                    coding: StringCoding::UTF8,
                    has_variable_info: true,
                    has_trace_info: false,
                },
                name: Some("UcbfX".to_string()),
                unit: Some("seconds".to_string()),
                fixed_point: None,
                value: Value::U32(2_063_359_909),
            }]),
        };
        let msg_conf = MessageConfig {
            version: 0,
            endianness: Endianness::Big,
            counter: 21,
            ecu_id: Some("AA".to_string()),
            session_id: None,
            timestamp: None,
            payload,
            extended_header_info: Some(ExtendedHeaderConfig {
                message_type: MessageType::Log(LogLevel::Warn),
                app_id: "o".to_string(),
                context_id: "hK".to_string(),
            }),
        };
        let msg = Message::new(msg_conf, None, None);
        println!("--> test_parse_msg: msg: {:?}", msg);
        let mut msg_bytes = msg.as_bytes();
        dump_to_file(&msg_bytes).expect("could not dump bytes");
        println!("--> test_parse_msg: msg_bytes: {:02X?}", msg_bytes);

        msg_bytes.extend(b"----");
        let res: IResult<&[u8], Option<Message>> =
            dlt_message(&msg_bytes, None, 0, 0, None, None, false);
        let expected: IResult<&[u8], Option<Message>> = Ok((b"----", Some(msg)));
        assert_eq!(expected, res);
    }
    use std::path::PathBuf;
    #[test]
    fn test_storage_header_illegeal() {
        let in_path = PathBuf::from("..")
            .join("dlt/test_samples")
            .join("lukas_crash.dlt");
        let out_path = PathBuf::from("..")
            .join("dlt/test_samples")
            .join("lukas_crash.dlt.out");

        let source_file_size = Some(std::fs::metadata(&in_path).unwrap().len() as usize);
        let (tx, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
        let chunk_size = 500usize;
        let tag_string = "TAG".to_string();
        let _res = create_index_and_mapping_dlt(
            IndexingConfig {
                tag: tag_string.as_str(),
                chunk_size,
                in_file: in_path,
                out_path: &out_path,
                append: false,
            },
            source_file_size,
            None,
            tx,
            None,
            None,
        );
    }

    #[test]
    fn test_parse_offending_argument() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::SignedFixedPoint(FloatWidth::Width64),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: Some("a".to_string()),
            unit: Some("a".to_string()),
            fixed_point: Some(FixedPoint {
                quantization: 1.0,
                offset: FixedPointValue::I64(1),
            }),
            value: Value::I64(-1_246_093_129_526_187_791),
        };

        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test2_parse_offending_argument() {
        let argument = Argument {
            type_info: TypeInfo {
                kind: TypeInfoKind::SignedFixedPoint(FloatWidth::Width32),
                coding: StringCoding::UTF8,
                has_variable_info: true,
                has_trace_info: false,
            },
            name: Some("a".to_string()),
            unit: Some("A".to_string()),
            fixed_point: Some(FixedPoint {
                quantization: 0.1,
                offset: FixedPointValue::I32(0),
            }),
            value: Value::I32(1_319_631_541),
        };

        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_bool_argument() {
        {
            let type_info = TypeInfo {
                kind: TypeInfoKind::Bool,
                coding: StringCoding::UTF8,
                has_variable_info: false,
                has_trace_info: false,
            };
            let argument = Argument {
                type_info,
                name: None,
                unit: None,
                fixed_point: None,
                value: Value::Bool(true),
            };
            println!("argument: {:?}", argument);
            let mut argument_bytes = argument.as_bytes::<BigEndian>();
            println!("argument bytes: {:02X?}", argument_bytes);
            argument_bytes.extend(b"4321");
            let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
            let expected: IResult<&[u8], Argument> = Ok((b"4321", argument));
            assert_eq!(expected, res);
        }
        // now with variable info
        {
            let type_info = TypeInfo {
                kind: TypeInfoKind::Bool,
                coding: StringCoding::UTF8,
                has_variable_info: true,
                has_trace_info: false,
            };
            let argument = Argument {
                type_info,
                name: Some("abc".to_string()),
                unit: None,
                fixed_point: None,
                value: Value::Bool(true),
            };
            println!("argument: {:?}", argument);
            let mut argument_bytes = argument.as_bytes::<BigEndian>();
            println!("argument bytes: {:02X?}", argument_bytes);
            argument_bytes.extend(b"----");
            let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
            let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
            assert_eq!(expected, res);
        }
    }
    #[test]
    fn test_parse_unsigned_argument() {
        {
            let type_info = TypeInfo {
                kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
                coding: StringCoding::UTF8,
                has_variable_info: false,
                has_trace_info: false,
            };
            let argument = Argument {
                type_info,
                name: None,
                unit: None,
                fixed_point: None,
                value: Value::U32(0x123),
            };
            let mut argument_bytes = argument.as_bytes::<BigEndian>();
            trace!("argument bytes: {:02X?}", argument_bytes);
            argument_bytes.extend(b"----");
            let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
            let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
            assert_eq!(expected, res);
        }
        // now with variable info
        {
            let type_info = TypeInfo {
                kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
                coding: StringCoding::UTF8,
                has_variable_info: true,
                has_trace_info: false,
            };
            let argument = Argument {
                type_info,
                name: Some("speed".to_string()),
                unit: Some("mph".to_string()),
                fixed_point: None,
                value: Value::U32(0x123),
            };
            let mut argument_bytes = argument.as_bytes::<BigEndian>();
            trace!("argument bytes: {:02X?}", argument_bytes);
            argument_bytes.extend(b"----");
            let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
            let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
            assert_eq!(expected, res);
        }
    }
    #[test]
    fn test_problem_arg() {
        let argument = Argument {
            type_info: TypeInfo {
                kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
                coding: StringCoding::UTF8,
                has_variable_info: true,
                has_trace_info: false,
            },
            name: Some("UcbfX".to_string()),
            unit: Some("seconds".to_string()),
            fixed_point: None,
            value: Value::U32(2_063_359_909),
            // type_info: TypeInfo {
            //     kind: TypeInfoKind::UnsignedFixedPoint(FloatWidth::Width32),
            //     coding: StringCoding::ASCII,
            //     has_variable_info: false,
            //     has_trace_info: false,
            // },
            // name: None,
            // unit: None,
            // fixed_point: Some(FixedPoint {
            //     quantization: 0.0,
            //     offset: FixedPointValue::I32(0),
            // }),
            // value: Value::U32(0),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_signed_argument() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength16),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::I16(-23),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: Some("temperature".to_string()),
            unit: Some("celcius".to_string()),
            fixed_point: None,
            value: Value::I32(-23),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_float_argument() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width32),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::F32(123.98f32),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width64),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: Some("temperature".to_string()),
            unit: Some("celcius".to_string()),
            fixed_point: None,
            value: Value::F64(28.3),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_raw_argument() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
        // now with variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: Some("payload".to_string()),
            unit: None,
            fixed_point: None,
            value: Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes raw: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_parse_string_argument() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::StringVal("foo".to_string()),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }

    // #[test]
    // fn test_dlt_message_parsing() {
    //     let raw1: Vec<u8> = vec![
    //         // storage header
    //         0x44, 0x4C, 0x54, 0x01, 0x56, 0xA2, 0x91, 0x5C, 0x9C, 0x91, 0x0B, 0x00, 0x45, 0x43,
    //         0x55, 0x31, // header
    //         0x3D, // header type 0b11 1101
    //         0x40, 0x00, 0xA2, 0x45, 0x43, 0x55, 0x31, // ecu id
    //         0x00, 0x00, 0x01, 0x7F, // session id
    //         0x00, 0x5B, 0xF7, 0x16, // timestamp
    //         // extended header
    //         0x51, // MSIN 0b101 0001 => verbose, MST log,
    //         0x06, // arg count
    //         0x56, 0x53, 0x6F, 0x6D, // app id VSom
    //         0x76, 0x73, 0x73, 0x64, // context id vssd
    //         // arguments
    //         // 0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
    //         // 0x3A, 0x00,
    //         // 0x5B, 0x33, 0x38, 0x33, 0x3A, 0x20, 0x53, 0x65,
    //         // 0x72, 0x76, 0x69, 0x63, 0x65, 0x44, 0x69, 0x73, 0x63, 0x6F, 0x76, 0x65, 0x72, 0x79,
    //         // 0x55, 0x64, 0x70, 0x45, 0x6E, 0x64, 0x70, 0x6F, 0x69, 0x6E, 0x74, 0x28, 0x31, 0x36,
    //         // 0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39, 0x39, 0x2E, 0x31, 0x30, 0x32, 0x3A, 0x35,
    //         // 0x30, 0x31, 0x35, 0x32, 0x29, 0x5D, 0x20, 0x00,
    //         0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
    //         0x0F, 0x00, // length
    //         0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x4D, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65,
    //         0x00, // "ProcessMessage"
    //         0x00, 0x82, 0x00, 0x00, // type info 0b1000001000000000
    //         0x02, 0x00, // length
    //         0x3A, 0x00, // ":"
    //         0x23, 0x00, 0x00, 0x00, // type info 0b10000000001000010
    //         0x0D, 0x01, 0x00, 0x00, 0x00, 0x82, 0x00, 0x00, 0x03, 0x00, 0x3A, 0x20, 0x00, 0x00,
    //         0x82, 0x00, 0x00, 0x14, 0x00, 0x31, 0x36, 0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39,
    //         0x39, 0x2E, 0x31, 0x36, 0x2C, 0x33, 0x30, 0x35, 0x30, 0x31, 0x00,
    //     ];
    //     let raw2: Vec<u8> = vec![
    //         0x44, 0x4C, 0x54, 0x01, 0x56, 0xA2, 0x91, 0x5C, 0x9C, 0x91, 0x0B, 0x00, 0x45, 0x43,
    //         0x55, 0x31, 0x3D, 0x41, 0x00, 0xA9, 0x45, 0x43, 0x55, 0x31, 0x00, 0x00, 0x01, 0x7F,
    //         0x00, 0x5B, 0xF7, 0x16, 0x51, 0x09, 0x56, 0x53, 0x6F, 0x6D, 0x76, 0x73, 0x73, 0x64,
    //         0x00, 0x82, 0x00, 0x00, 0x3A, 0x00, 0x5B, 0x33, 0x38, 0x33, 0x3A, 0x20, 0x53, 0x65,
    //         0x72, 0x76, 0x69, 0x63, 0x65, 0x44, 0x69, 0x73, 0x63, 0x6F, 0x76, 0x65, 0x72, 0x79,
    //         0x55, 0x64, 0x70, 0x45, 0x6E, 0x64, 0x70, 0x6F, 0x69, 0x6E, 0x74, 0x28, 0x31, 0x36,
    //         0x30, 0x2E, 0x34, 0x38, 0x2E, 0x31, 0x39, 0x39, 0x2E, 0x31, 0x30, 0x32, 0x3A, 0x35,
    //         0x30, 0x31, 0x35, 0x32, 0x29, 0x5D, 0x20, 0x00, 0x00, 0x82, 0x00, 0x00, 0x0F, 0x00,
    //         0x50, 0x72, 0x6F, 0x63, 0x65, 0x73, 0x73, 0x4D, 0x65, 0x73, 0x73, 0x61, 0x67, 0x65,
    //         0x00, 0x00, 0x82, 0x00, 0x00, 0x02, 0x00, 0x3A, 0x00, 0x23, 0x00, 0x00, 0x00, 0x24,
    //         0x01, 0x00, 0x00, 0x00, 0x82, 0x00, 0x00, 0x06, 0x00, 0x3A, 0x20, 0x28, 0x30, 0x78,
    //         0x00, 0x42, 0x00, 0x01, 0x00, 0x36, 0x15, 0x00, 0x82, 0x00, 0x00, 0x04, 0x00, 0x2C,
    //         0x30, 0x78, 0x00, 0x42, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x82, 0x00, 0x00, 0x02,
    //         0x00, 0x29, 0x00,
    //     ];
    //     let res1: IResult<&[u8], Option<Message>> =
    //         dlt_message(&raw1[..], Some(LogLevel::Debug));
    //     trace!("res1 was: {:?}", res1);
    //     let res2: IResult<&[u8], Option<Message>> = dlt_message(&raw2[..], None);
    //     trace!("res was: {:?}", res2);
    // }
    #[test]
    fn test_parse_fixed_point_argument() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::SignedFixedPoint(FloatWidth::Width32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            value: Value::I32(-44),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        let mut argument_bytes = argument.as_bytes::<BigEndian>();
        trace!("argument bytes: {:02X?}", argument_bytes);
        argument_bytes.extend(b"----");
        let res: IResult<&[u8], Argument> = dlt_argument::<BigEndian>(&argument_bytes);
        let expected: IResult<&[u8], Argument> = Ok((b"----", argument));
        assert_eq!(expected, res);
    }

    #[test]
    fn test_dlt_zero_terminated_string_exact() {
        let mut buf = BytesMut::with_capacity(4);
        buf.extend_from_slice(b"id42");
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        let expected: IResult<&[u8], &str> = Ok((&[], "id42"));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_more_data() {
        let mut buf = BytesMut::with_capacity(6);
        buf.extend_from_slice(b"id42++");
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        let expected: IResult<&[u8], &str> = Ok((b"++", "id42"));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_less_data() {
        let mut buf = BytesMut::with_capacity(4);
        buf.extend_from_slice(b"id\0");
        assert!(match dlt_zero_terminated_string(&buf, 4) {
            Err(nom::Err::Incomplete(nom::Needed::Size(_))) => true,
            _ => false,
        });
        buf.clear();
        buf.extend_from_slice(b"id\0\0");
        let expected: IResult<&[u8], &str> = Ok((b"", "id"));
        assert_eq!(expected, dlt_zero_terminated_string(&buf, 4));
    }
    #[test]
    fn test_dlt_zero_terminated_string_early_terminated() {
        let mut buf = BytesMut::with_capacity(4);
        buf.extend_from_slice(b"id4\0somethingelse");
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        trace!("res : {:?}", res);
        let expected: IResult<&[u8], &str> = Ok((b"somethingelse", "id4"));
        assert_eq!(expected, res);
    }
    #[test]
    fn test_dlt_zero_terminated_string_non_utf8() {
        let mut buf = BytesMut::with_capacity(4);
        let broken = vec![0x41, 0, 146, 150];
        buf.extend_from_slice(&broken);
        let res: IResult<&[u8], &str> = dlt_zero_terminated_string(&buf, 4);
        let expected: IResult<&[u8], &str> = Ok((b"", "A"));
        assert_eq!(expected, res);
    }
}
