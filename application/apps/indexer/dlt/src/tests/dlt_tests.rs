#[cfg(test)]
mod tests {
    use crate::{dlt::*, proptest_strategies::argument_strategy};
    use byteorder::ByteOrder;
    use proptest::prelude::*;

    use byteorder::{BigEndian, LittleEndian};
    use pretty_assertions::assert_eq;

    proptest! {
        #[test]
        fn convert_type_info_to_bytes_doesnt_crash(type_info: TypeInfo) {
            let _ = type_info.as_bytes::<BigEndian>();
        }
        #[test]
        fn length_of_dlt_arg_is_number_of_bytes(arg in argument_strategy()) {
            let expected = arg.as_bytes::<BigEndian>().len();
            let expected_using_little_endian = arg.as_bytes::<LittleEndian>().len();
            let calculated = arg.len_new();
            assert_eq!(
                expected,
                calculated
            );
            assert_eq!(
                expected_using_little_endian,
                calculated
            );
        }
    }

    // string coding .......................^^.^|||      ||||
    // type struct .............................^||      ||||
    // trace info ...............................^|      ||||
    // fixed point ...............................^      ||||
    #[test]
    fn test_convert_header_to_bytes() {
        // 0x37 =  0b0011 0111
        //           |||| ||||
        // version...^^^| |||| == 1
        // timestamp....^ |||| == true

        // with ses.id....^||| == false
        // with ecuid......^|| == true
        // big endian...... ^| == true
        // ext.head..........^ == true
        let header: StandardHeader = StandardHeader {
            version: 1,
            endianness: Endianness::Big,
            has_extended_header: true,
            message_counter: 0x33,
            payload_length: 0x1,
            ecu_id: Some("abc".to_string()),
            session_id: None,
            timestamp: Some(5),
        };
        assert_eq!(
            vec![
                0x37, // header-type
                0x33, // message-counter
                0x0, 0x17, // overall length
                0x61, 0x62, 0x63, 0x0, // ecu id "abc"
                0x0, 0x0, 0x0, 0x5, // timestamp
            ],
            header.as_bytes()
        );
    }
    #[test]
    fn test_filter_nothing_with_invalid_level() {
        let extended_header = ExtendedHeader {
            argument_count: 1,
            verbose: true,
            message_type: MessageType::Log(LogLevel::Invalid(1)),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        assert!(!extended_header.skip_with_level(LogLevel::Verbose));
        assert!(!extended_header.skip_with_level(LogLevel::Invalid(0)));
        assert!(!extended_header.skip_with_level(LogLevel::Invalid(1)));
        assert!(extended_header.skip_with_level(LogLevel::Invalid(2)));
    }
    #[test]
    fn test_filter_out_non_relevant_ext_headers() {
        let extended_header = ExtendedHeader {
            argument_count: 1,
            verbose: true,
            message_type: MessageType::Log(LogLevel::Debug),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        assert!(!extended_header.skip_with_level(LogLevel::Verbose));
        assert!(!extended_header.skip_with_level(LogLevel::Debug));
        assert!(extended_header.skip_with_level(LogLevel::Info));
        assert!(extended_header.skip_with_level(LogLevel::Warn));
        assert!(extended_header.skip_with_level(LogLevel::Error));
        assert!(extended_header.skip_with_level(LogLevel::Fatal));
        let extended_header = ExtendedHeader {
            argument_count: 1,
            verbose: true,
            message_type: MessageType::Control(ControlType::Request),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        // other message types should not be fitered
        assert!(!extended_header.skip_with_level(LogLevel::Fatal));
    }
    #[test]
    fn test_convert_extended_header_to_bytes() {
        let extended_header = ExtendedHeader {
            argument_count: 2,
            verbose: true,
            message_type: MessageType::Log(LogLevel::Warn),
            application_id: "abc".to_string(),
            context_id: "CON".to_string(),
        };
        assert_eq!(
            vec![
                0b0011_0001, // message info MSIN
                0x2,         // arg-count
                0x61,
                0x62,
                0x63,
                0x0, // app id
                0x43,
                0x4F,
                0x4E,
                0x0, // context id
            ],
            extended_header.as_bytes()
        );
    }
    #[test]
    fn test_convert_storage_header_to_bytes() {
        let timestamp = DltTimeStamp {
            seconds: 0x4DC9_2C26,
            microseconds: 0x000C_A2D8,
        };
        let storage_header = StorageHeader {
            timestamp,
            ecu_id: "abc".to_string(),
        };
        assert_eq!(
            vec![
                0x44, 0x4C, 0x54, 0x01, // dlt tag
                0x26, 0x2C, 0xC9, 0x4D, // timestamp seconds
                0xD8, 0xA2, 0x0C, 0x0, // timestamp microseconds
                0x61, 0x62, 0x63, 0x0, // ecu id "abc"
            ],
            storage_header.as_bytes()
        );
    }
    #[test]
    fn test_convert_typeinfo_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let type_info2 = TypeInfo {
            kind: TypeInfoKind::UnsignedFixedPoint(FloatWidth::Width32),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        };
        let type_info3 = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        //                                                        vvvv..type lenght
        // type array .....................................v      ||||
        // type string ...................................v|      ||||
        // type raw .....................................v||      ||||
        // variable info................................v|||      ||||
        //0b 1000 0100 0101
        let expected1: u32 = 0b0000_0000_0000_0000_1000_1000_0001_0000;
        let expected2: u32 = 0b0000_0000_0000_0000_0001_0000_0100_0011;
        let expected3: u32 = 0b0000_0000_0000_0000_1000_0010_0000_0000;
        // string coding .......................^^.^|||      ||||
        // type struct .............................^||      ||||
        // trace info ...............................^|      ||||
        // fixed point ...............................^      ||||
        //                                         float.....^|||
        //                                         unsigned...^||
        //                                         signed......^|
        //                                         bool.........^
        println!("expected: {:#b}", expected2);
        println!(
            "got     : {:#b}",
            BigEndian::read_u32(&type_info2.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected1,
            BigEndian::read_u32(&type_info.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected1,
            LittleEndian::read_u32(&type_info.as_bytes::<LittleEndian>()[..])
        );
        assert_eq!(
            expected2,
            BigEndian::read_u32(&type_info2.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected2,
            LittleEndian::read_u32(&type_info2.as_bytes::<LittleEndian>()[..])
        );
        assert_eq!(
            expected3,
            BigEndian::read_u32(&type_info3.as_bytes::<BigEndian>()[..])
        );
        assert_eq!(
            expected3,
            LittleEndian::read_u32(&type_info3.as_bytes::<LittleEndian>()[..])
        );
    }
    #[test]
    fn test_convert_bool_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let argument = Argument {
            type_info: type_info.clone(),
            name: Some("foo".to_string()),
            unit: None,
            fixed_point: None,
            value: Value::Bool(0x1),
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        expected.extend(vec![0x0, 0x4]); // length of name + zero
        expected.extend(b"foo\0");
        expected.extend(vec![0x1]); // value for bool (true == 1)
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info2 = TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected2 = type_info2.as_bytes::<BigEndian>();
        let argument2 = Argument {
            type_info: type_info2,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::Bool(0x1),
        };
        expected2.extend(vec![0x1]); // value for bool (true == 1)
        assert_eq!(expected2, argument2.as_bytes::<BigEndian>());
    }
    #[test]
    fn test_convert_uint_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: Value::U32(0x33),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_u32(&mut buf, 0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::U32(0x33),
        };
        let mut buf = [0; 4];
        BigEndian::write_u32(&mut buf, 0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }

    #[test]
    fn test_convert_sint_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: Value::I32(-0x33),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_i32(&mut buf, -0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::I32(-0x33),
        };
        let mut buf = [0; 4];
        BigEndian::write_i32(&mut buf, -0x33);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }

    #[test]
    fn test_convert_float_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: Some("mph".to_string()),
            fixed_point: None,
            value: Value::F32(123.98f32),
        };
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_f32(&mut buf, 123.98f32);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width64),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::F64(123.98f64),
        };
        let mut buf = [0; 8];
        BigEndian::write_f64(&mut buf, 123.98f64);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }
    #[test]
    fn test_convert_string_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("speed".to_string()),
            unit: None,
            fixed_point: None,
            value: Value::StringVal("foo".to_string()),
        };
        expected.extend(vec![0x0, 0x4]); // length of value + zero
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(b"speed\0"); // name
        expected.extend(b"foo\0"); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            fixed_point: None,
            value: Value::StringVal("foo".to_string()),
        };
        expected.extend(vec![0x0, 0x4]); // length of value + zero
        expected.extend(b"foo\0"); // value
        let argument_bytes = argument.as_bytes::<BigEndian>();
        println!("{:02X?}", argument_bytes);
        assert_eq!(expected, argument_bytes);
    }
    #[test]
    fn test_convert_fixedpoint_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::SignedFixedPoint(FloatWidth::Width32),
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
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
        expected.extend(vec![0x0, 0x6]); // length of name + zero
        expected.extend(vec![0x0, 0x4]); // length of unit + zero
        expected.extend(b"speed\0");
        expected.extend(b"mph\0");
        let mut buf = [0; 4];
        BigEndian::write_f32(&mut buf, 1.5f32);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -200);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -44);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::SignedFixedPoint(FloatWidth::Width32),
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            value: Value::I32(-44),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        let mut buf = [0; 4];
        BigEndian::write_f32(&mut buf, 1.5f32);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -200);
        expected.extend(&buf); // value
        BigEndian::write_i32(&mut buf, -44);
        expected.extend(&buf); // value
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }
    #[test]
    fn test_convert_raw_argument_to_bytes() {
        let type_info = TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::UTF8,
            has_variable_info: true,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: Some("foo".to_string()),
            unit: None,
            value: Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        expected.extend(vec![0x0, 0x4]); // length of raw data bytes
        expected.extend(vec![0x0, 0x4]); // length of name + zero
        expected.extend(b"foo\0");
        expected.extend(vec![0xD, 0xE, 0xA, 0xD]);
        assert_eq!(expected, argument.as_bytes::<BigEndian>());

        // now without variable info
        let type_info = TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        };
        let mut expected = type_info.as_bytes::<BigEndian>();
        let argument = Argument {
            type_info,
            name: None,
            unit: None,
            value: Value::Raw(vec![0xD, 0xE, 0xA, 0xD]),
            fixed_point: Some(FixedPoint {
                quantization: 1.5,
                offset: FixedPointValue::I32(-200),
            }),
        };
        expected.extend(vec![0x0, 0x4]); // length of raw data bytes
        expected.extend(vec![0xD, 0xE, 0xA, 0xD]);
        assert_eq!(expected, argument.as_bytes::<BigEndian>());
    }
}
