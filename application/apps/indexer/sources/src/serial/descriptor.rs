use components::{ComponentDescriptor, ComponentFactory, StaticFieldResult};
use std::{collections::HashMap, str};
use stypes::{
    ExtractByKey, Extracted, Field, FieldDesc, LazyFieldDesc, NativeError, NativeErrorKind,
    SessionAction, Severity, StaticFieldDesc, ValueInput, missed_field_err as missed,
};

use crate::prelude::SerialSource;

use super::serialport::SerialConfig;

const SERIAL_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
]);

/// The path to the serial port.
const FIELD_PATH: &str = "SERIAL_SOURCE_FIELD_PATH";
/// The baud rate for the connection.
const FIELD_BAUD_RATE: &str = "SERIAL_SOURCE_FIELD_BAUD_RATE";
/// The number of data bits per frame.
const FIELD_DATA_BITS: &str = "SERIAL_SOURCE_FIELD_DATA_BITS";
/// The flow control setting.
const FIELD_FLOW_CONTROL: &str = "SERIAL_SOURCE_FIELD_FLOW_CONTROL";
/// The parity setting.
const FIELD_PARITY: &str = "SERIAL_SOURCE_FIELD_PARITY";
/// The number of stop bits.
const FIELD_STOP_BITS: &str = "SERIAL_SOURCE_FIELD_STOP_BITS";
/// The delay in sending data, in milliseconds.
const FIELD_SEND_DATA_DELAY: &str = "SERIAL_SOURCE_FIELD_SEND_DATA_DELAY";
/// Whether the connection is exclusive.
const FIELD_EXCLUSIVE: &str = "SERIAL_SOURCE_FIELD_EXCLUSIVE";
/// List of ports
const FIELD_PORTS_LIST: &str = "SERIAL_SOURCE_PORTS_LIST_FIELD";

#[derive(Default)]
pub struct Descriptor {}

impl ComponentFactory<crate::Source> for Descriptor {
    fn create(
        &self,
        origin: &SessionAction,
        options: &[Field],
    ) -> Result<Option<(crate::Source, Option<String>)>, NativeError> {
        let errors = self.validate(origin, options)?;
        if !errors.is_empty() {
            return Err(NativeError {
                kind: NativeErrorKind::Configuration,
                severity: Severity::ERROR,
                message: Some(
                    errors
                        .values()
                        .map(String::as_str)
                        .collect::<Vec<_>>()
                        .join("; "),
                ),
            });
        }
        let path: String = options
            .extract_by_key(FIELD_PATH)
            .ok_or(missed(FIELD_PATH))?
            .value;
        let config = SerialConfig {
            path: path.clone(),
            baud_rate: options
                .extract_by_key(FIELD_BAUD_RATE)
                .ok_or(missed(FIELD_BAUD_RATE))?
                .value,
            data_bits: options
                .extract_by_key(FIELD_DATA_BITS)
                .ok_or(missed(FIELD_DATA_BITS))?
                .value,
            flow_control: options
                .extract_by_key(FIELD_FLOW_CONTROL)
                .ok_or(missed(FIELD_FLOW_CONTROL))?
                .value,
            parity: options
                .extract_by_key(FIELD_PARITY)
                .ok_or(missed(FIELD_PARITY))?
                .value,
            stop_bits: options
                .extract_by_key(FIELD_STOP_BITS)
                .ok_or(missed(FIELD_STOP_BITS))?
                .value,
            send_data_delay: options
                .extract_by_key(FIELD_SEND_DATA_DELAY)
                .ok_or(missed(FIELD_SEND_DATA_DELAY))?
                .value,
            exclusive: options
                .extract_by_key(FIELD_EXCLUSIVE)
                .ok_or(missed(FIELD_EXCLUSIVE))?
                .value,
        };
        Ok(Some((
            crate::Source::Serial(SerialSource::new(config)?),
            Some(path),
        )))
    }
}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SessionAction) -> bool {
        match origin {
            SessionAction::File(..) | SessionAction::Files(..) | SessionAction::ExportRaw(..) => {
                false
            }
            SessionAction::Source => true,
        }
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Serial Port Connection"),
            desc: String::from(
                "Connects to the specified serial port using user-defined settings. Data is received as a raw byte stream in a \"as-is\" mode - that is, the parser receives exactly what was read from the port, without any framing.",
            ),
            io: stypes::IODataType::PlaitText,
            uuid: SERIAL_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
    fn fields_getter(&self, _origin: &SessionAction) -> components::FieldsResult {
        Ok(vec![
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_PATH.to_owned(),
                name: "Path to dev".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::String(String::new(), "/dev/tty01".to_owned()),
                binding: None,
            }),
            FieldDesc::Lazy(LazyFieldDesc {
                id: FIELD_PORTS_LIST.to_string(),
                name: "Ports".to_string(),
                desc: String::new(),
                binding: Some(FIELD_PATH.to_string()),
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_BAUD_RATE.to_owned(),
                name: "Boud rate".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Numbers(
                    vec![
                        50, 75, 110, 134, 150, 200, 300, 600, 1200, 1800, 2400, 4800, 9600, 19200,
                        38400, 57600, 115200, 230400, 460800, 500000, 576000, 921600, 1000000,
                        1152000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000,
                    ],
                    115200,
                ),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_DATA_BITS.to_owned(),
                name: "Data bits".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Numbers(vec![8, 7, 6, 5], 8),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_STOP_BITS.to_owned(),
                name: "Stop bits".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Numbers(vec![1, 2], 1),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_FLOW_CONTROL.to_owned(),
                name: "Flow control".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Strings(
                    vec![
                        String::from("None"),
                        String::from("Hardware"),
                        String::from("Software"),
                    ],
                    String::from("None"),
                ),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_PARITY.to_owned(),
                name: "Parity".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Strings(
                    vec![
                        String::from("None"),
                        String::from("Odd"),
                        String::from("Even"),
                    ],
                    String::from("None"),
                ),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_EXCLUSIVE.to_owned(),
                name: "Exclusive".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::NamedBools(vec![
                    (String::from("Yes"), true),
                    (String::from("No"), false),
                ]),
                binding: None,
            }),
            FieldDesc::Static(StaticFieldDesc {
                id: FIELD_SEND_DATA_DELAY.to_owned(),
                name: "Send delay, ms".to_owned(),
                desc: String::new(),
                required: true,
                interface: ValueInput::Numbers(vec![0, 10, 20, 30, 40, 50], 0),
                binding: None,
            }),
        ])
    }
    fn lazy_fields_getter(
        &self,
        _origin: SessionAction,
        _cancel: tokio_util::sync::CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async move {
            let ports = serialport::available_ports()
                .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))?
                .into_iter()
                .map(|p| p.port_name)
                .collect::<Vec<String>>();
            Ok(vec![StaticFieldResult::Success(StaticFieldDesc {
                id: FIELD_PORTS_LIST.to_owned(),
                name: "Ports".to_string(),
                desc: "List of available ports".to_string(),
                required: false,
                interface: ValueInput::Strings(ports, String::new()),
                binding: Some(FIELD_PATH.to_string()),
            })])
        })
    }
    fn validate(
        &self,
        _origin: &SessionAction,
        fields: &[Field],
    ) -> Result<HashMap<String, String>, NativeError> {
        let path: Extracted<String> = fields
            .extract_by_key(FIELD_PATH)
            .ok_or(missed(FIELD_PATH))?;
        let mut errors = HashMap::new();
        if path.value.trim().is_empty() {
            errors.insert(path.id.to_owned(), "Path cannot be empty".to_owned());
        }
        Ok(errors)
    }
}
