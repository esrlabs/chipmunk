use crate::dlt::*;
use byteorder::{BigEndian, LittleEndian};
use proptest::prelude::*;

prop_compose! {
    fn ecu_id_strategy()(id in "[a-zA-Z]{2,5}") /*"*/-> Option<String> {
        if id.len() == 5 { None } else { Some(id) }
    }
}
fn unit_name_strategy() -> impl Strategy<Value = String> {
    prop_oneof![
        Just("cm".to_string()),
        Just("meter".to_string()),
        Just("seconds".to_string()),
        Just("minutes".to_string()),
    ]
}
prop_compose! {
    fn name_and_unit_strategy(has_variable_info: bool, kind: TypeInfoKind)
        (name in "[a-zA-Z]{2,5}", /*"*/
         unit in unit_name_strategy())
            -> (Option<String>, Option<String>) {
        if has_variable_info {
            if kind == TypeInfoKind::Bool || kind == TypeInfoKind::StringType || kind == TypeInfoKind::Raw {
                (Some(name), None)
            } else {
                (Some(name), Some(unit))
            }
        } else {
            (None, None)
        }
    }
}
prop_compose! {
    pub fn header_strategy(payload_length: u16, endianness: Endianness)(
        version in 0..8u8,
        message_counter in any::<u8>(),
        ecu_id in ecu_id_strategy(),
        session_id in any::<Option<u32>>(),
        timestamp in any::<Option<u32>>(),
    ) -> StandardHeader {
        let has_extended_header = true;
        StandardHeader {
                version,
                endianness,
                has_extended_header,
                message_counter,
                ecu_id,
                session_id,
                timestamp,
                payload_length,
        }
    }
}

prop_compose! {
    pub fn message_strat()
                ((ext_header, payload, standard_header) in extheader_payload_endian_strategy()
                    .prop_flat_map(|(ext_header, payload, endianness)| {
                        let payload_length = if endianness == Endianness::Big {
                            payload.as_bytes::<BigEndian>().len()
                        } else {
                            payload.as_bytes::<LittleEndian>().len()
                        } as u16;
                        (Just(ext_header), Just(payload), header_strategy(payload_length, endianness))
                    })
                )
                -> Message {
        let payload_length = if standard_header.endianness == Endianness::Big {
            payload.as_bytes::<BigEndian>().len()
        } else {
            payload.as_bytes::<LittleEndian>().len()
        } as u16;
        let header = StandardHeader { payload_length, ..standard_header };
        let real_arg_cnt = match &payload {
            PayloadContent::Verbose(args) => args.len(),
            _ => 0,
        };
        // println!("changing msg type from {} ...", ext_header.message_type);
        let real_msg_type = match &payload {
            PayloadContent::ControlMsg(control_type, _) => MessageType::Control(control_type.clone()),
            PayloadContent::Verbose(_) => MessageType::Log(LogLevel::Warn),
            PayloadContent::NonVerbose(_, _) => MessageType::Log(LogLevel::Debug),
        };
        // println!("... to {}", real_msg_type);
        // correct extended header fiels according to payload
        let extended_header = ExtendedHeader {
                                verbose: payload.is_verbose(),
                                argument_count: real_arg_cnt as u8,
                                message_type: real_msg_type,
                                ..ext_header };

        Message {
            storage_header: None,
            header,
            extended_header: Some(extended_header),
            payload,
        }
    }
}

pub fn message_with_storage_header_strat() -> impl Strategy<Value = Message> {
    let storage_header = any::<StorageHeader>();
    (message_strat(), storage_header).prop_map(|(m, storage_h)| Message {
        storage_header: Some(storage_h),
        ..m
    })
}

pub fn messages_strat(len: usize) -> impl Strategy<Value = Vec<Message>> {
    prop::collection::vec(message_strat(), 0..len)
}

pub fn stored_messages_strat(len: usize) -> impl Strategy<Value = Vec<Message>> {
    prop::collection::vec(message_with_storage_header_strat(), 0..len)
}

fn value_strategy(info: &TypeInfo) -> impl Strategy<Value = Value> {
    // println!("value_strategy for {:?}", info);
    match &info.kind {
        TypeInfoKind::Bool => (0..10u8).prop_map(Value::Bool).boxed(),
        TypeInfoKind::Float(FloatWidth::Width32) => any::<f32>().prop_map(Value::F32).boxed(),
        TypeInfoKind::Float(FloatWidth::Width64) => any::<f64>().prop_map(Value::F64).boxed(),
        TypeInfoKind::Raw => prop::collection::vec(any::<u8>(), 0..5)
            .prop_map(Value::Raw)
            .boxed(),
        TypeInfoKind::StringType => any::<String>()
            .prop_map(|v| {
                // println!("create StringType value: {}", v);
                Value::StringVal(v)
            })
            .boxed(),
        // signed i8-i64
        TypeInfoKind::Signed(TypeLength::BitLength8) => any::<i8>().prop_map(Value::I8).boxed(),
        TypeInfoKind::Signed(TypeLength::BitLength16) => any::<i16>().prop_map(Value::I16).boxed(),
        TypeInfoKind::Signed(TypeLength::BitLength32) => any::<i32>().prop_map(Value::I32).boxed(),
        TypeInfoKind::Signed(TypeLength::BitLength64) => any::<i64>().prop_map(Value::I64).boxed(),
        TypeInfoKind::Signed(TypeLength::BitLength128) => {
            any::<i128>().prop_map(Value::I128).boxed()
        }
        TypeInfoKind::SignedFixedPoint(FloatWidth::Width32) => {
            any::<i32>().prop_map(Value::I32).boxed()
        }
        TypeInfoKind::SignedFixedPoint(FloatWidth::Width64) => {
            any::<i64>().prop_map(Value::I64).boxed()
        }
        // unsigned u8-u64
        TypeInfoKind::Unsigned(TypeLength::BitLength8) => any::<u8>().prop_map(Value::U8).boxed(),
        TypeInfoKind::Unsigned(TypeLength::BitLength16) => {
            any::<u16>().prop_map(Value::U16).boxed()
        }
        TypeInfoKind::Unsigned(TypeLength::BitLength32) => {
            any::<u32>().prop_map(Value::U32).boxed()
        }
        TypeInfoKind::Unsigned(TypeLength::BitLength64) => {
            any::<u64>().prop_map(Value::U64).boxed()
        }
        TypeInfoKind::Unsigned(TypeLength::BitLength128) => {
            any::<u128>().prop_map(Value::U128).boxed()
        }
        TypeInfoKind::UnsignedFixedPoint(FloatWidth::Width32) => {
            any::<u32>().prop_map(Value::U32).boxed()
        }
        TypeInfoKind::UnsignedFixedPoint(FloatWidth::Width64) => {
            any::<u64>().prop_map(Value::U64).boxed()
        }
    }
}
#[allow(dead_code)]
fn vec_and_index() -> impl Strategy<Value = (Vec<String>, usize)> {
    prop::collection::vec(".*", 1..100).prop_flat_map(|vec| {
        let len = vec.len();
        (Just(vec), 0..len)
    })
}
prop_compose! {
    fn vec_and_index2()
    ((v, i) in
        prop::collection::vec(".*", 1..100).prop_flat_map(|vec| {
            let len = vec.len();
            (Just(vec), 0..len)
        })
    ) -> (Vec<String>, usize) {
        (v, i)
    }
}

// only produces None values
fn fp_none_strategy() -> impl Strategy<Value = Option<FixedPoint>> {
    Just(None)
}
fn fp_strategy(width: FloatWidth) -> impl Strategy<Value = FixedPoint> {
    let fp_value_strat = if width == FloatWidth::Width32 {
        any::<i32>().prop_map(FixedPointValue::I32).boxed()
    } else {
        any::<i64>().prop_map(FixedPointValue::I64).boxed()
    };
    (any::<f32>(), fp_value_strat).prop_map(|(quantization, offset)| FixedPoint {
        quantization,
        offset,
    })
}
// strategy that produces TypeInfo and matching optional FixedPoint for arguments
fn type_info_and_fixed_point_strategy() -> impl Strategy<
    Value = (
        TypeInfo,
        Option<FixedPoint>,
        Value,
        (Option<String>, Option<String>),
    ),
> {
    any::<TypeInfo>().prop_flat_map(move |ti| {
        let fp_strat = match ti.kind {
            TypeInfoKind::SignedFixedPoint(width) => fp_strategy(width).prop_map(Some).boxed(),
            TypeInfoKind::UnsignedFixedPoint(width) => fp_strategy(width).prop_map(Some).boxed(),
            _ => fp_none_strategy().boxed(),
        };
        let name_unit_strat = name_and_unit_strategy(ti.has_variable_info, ti.kind.clone());
        let val_strat = value_strategy(&ti);
        (Just(ti), fp_strat, val_strat, name_unit_strat)
    })
}

pub fn argument_strategy() -> impl Strategy<Value = Argument> {
    let ti_and_fp_and_val = type_info_and_fixed_point_strategy();
    ti_and_fp_and_val.prop_map(|(type_info, fixed_point, value, name_and_unit)| Argument {
        type_info,
        name: name_and_unit.0,
        unit: name_and_unit.1,
        fixed_point,
        value,
    })
    // any::<Argument>()
}
pub fn argument_vector_strategy() -> impl Strategy<Value = Vec<Argument>> {
    prop::collection::vec(argument_strategy(), 0..2)
}
fn payload_strategy(count: usize) -> impl Strategy<Value = PayloadContent> {
    if count == 0 {
        Just(PayloadContent::Verbose(vec![])).boxed()
    } else {
        prop::collection::vec(argument_strategy(), 0..count)
            .prop_flat_map(|args| Just(PayloadContent::Verbose(args)))
            .boxed()
    }
}
fn non_verbose_payload_strategy() -> impl Strategy<Value = PayloadContent> {
    prop_oneof![
        (0..10u32, prop::collection::vec(any::<u8>(), 0..5))
            .prop_map(|(a, b)| PayloadContent::NonVerbose(a, b)),
        (
            any::<ControlType>(),
            prop::collection::vec(any::<u8>(), 0..6)
        )
            .prop_map(|(a, b)| PayloadContent::ControlMsg(a, b))
    ]
}
// strategy to produce signed TypeInfoKinds for only 32 and 64 bit width fixed point or
// any other regular signed value
pub fn signed_strategy() -> impl Strategy<Value = TypeInfoKind> {
    prop_oneof![
        any::<FloatWidth>().prop_flat_map(|width| Just(TypeInfoKind::SignedFixedPoint(width))),
        any::<TypeLength>().prop_flat_map(|width| Just(TypeInfoKind::Signed(width)))
    ]
}
// strategy to produce unsigned TypeInfoKinds for only 32 and 64 bit width
pub fn unsigned_strategy() -> impl Strategy<Value = TypeInfoKind> {
    prop_oneof![
        any::<FloatWidth>().prop_flat_map(|width| Just(TypeInfoKind::UnsignedFixedPoint(width))),
        any::<TypeLength>().prop_flat_map(|width| Just(TypeInfoKind::Unsigned(width)))
    ]
}
fn extheader_payload_endian_strategy(
) -> impl Strategy<Value = (ExtendedHeader, PayloadContent, Endianness)> {
    any::<ExtendedHeader>().prop_flat_map(|ext_h| {
        let payload = if ext_h.verbose {
            payload_strategy(ext_h.argument_count as usize)
                .prop_flat_map(Just)
                .boxed()
        } else {
            non_verbose_payload_strategy().prop_flat_map(Just).boxed()
        };
        (Just(ext_h), payload, any::<Endianness>())
    })
}
