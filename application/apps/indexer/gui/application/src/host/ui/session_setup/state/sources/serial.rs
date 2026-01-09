use std::time::{Duration, Instant};

use itertools::Itertools;

const REGULAR_RESCAN_PORTS_DURATION: Duration = Duration::from_secs(10);
const NOPORTS_RESCAN_PORTS_DURATION: Duration = Duration::from_secs(5);

pub const DEFAULT_BAUD_RATE: u32 = 115200;

/// A value paired with a display name for UI selection.
#[derive(Debug, Clone)]
pub struct NamedValue<T> {
    pub value: T,
    pub name: &'static str,
}

impl<T: PartialEq> PartialEq for NamedValue<T> {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}

impl<T> NamedValue<T> {
    pub const fn new(value: T, name: &'static str) -> Self {
        Self { value, name }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum BaudRate {
    Custom(u32),
    Predefined(u32),
}

impl BaudRate {
    pub fn ui_text(&self) -> String {
        match self {
            BaudRate::Custom(_) => String::from("Custom"),
            BaudRate::Predefined(val) => val.to_string(),
        }
    }
}

impl Default for BaudRate {
    fn default() -> Self {
        BaudRate::Predefined(115200)
    }
}

#[derive(Debug, Clone)]
pub struct SerialConfig {
    // --- Path ---
    pub path: String,
    path_err: Option<&'static str>,
    pub available_ports: Vec<String>,
    last_ports_scan: Instant,

    // --- BaudRate ---
    pub baud_rate: BaudRate,
    pub available_bauds: Vec<BaudRate>,

    pub data_bits: u8,
    pub flow_control: NamedValue<u8>,
    pub parity: NamedValue<u8>,
    pub stop_bits: u8,
    pub send_data_delay: NamedValue<u8>,
    pub exclusive: NamedValue<bool>,
}

impl SerialConfig {
    pub const DATA_BITS: &[u8] = &[8, 7, 6, 5];

    pub const STOP_BITS: &[u8] = &[1, 2];

    pub const PARITY: &[NamedValue<u8>] = &[
        NamedValue::new(0, "None"),
        NamedValue::new(1, "Odd"),
        NamedValue::new(2, "Even"),
    ];

    pub const FLOW_CONTROL: &[NamedValue<u8>] = &[
        NamedValue::new(0, "None"),
        NamedValue::new(1, "Hardware"),
        NamedValue::new(2, "Software"),
    ];

    pub const EXCLUSIVE: &[NamedValue<bool>] = &[
        NamedValue::new(true, "Yes (default)"),
        NamedValue::new(false, "No"),
    ];

    pub const DELAY: &[NamedValue<u8>] = &[
        NamedValue::new(0, "No delay (default)"),
        NamedValue::new(10, "10 ms"),
        NamedValue::new(20, "20 ms"),
        NamedValue::new(30, "30 ms"),
        NamedValue::new(40, "40 ms"),
        NamedValue::new(50, "50 ms"),
    ];

    pub fn new() -> Self {
        let available_ports = Self::scan_ports();
        let available_bauds = Self::all_baud_rates();

        let mut config = Self {
            path: String::new(),
            path_err: None,
            available_ports,
            last_ports_scan: Instant::now(),

            baud_rate: BaudRate::default(),
            available_bauds,

            data_bits: Self::DATA_BITS[0],
            flow_control: Self::FLOW_CONTROL[0].to_owned(),
            parity: Self::PARITY[0].to_owned(),
            stop_bits: Self::STOP_BITS[0],
            exclusive: Self::EXCLUSIVE[0].to_owned(),
            send_data_delay: Self::DELAY[0].to_owned(),
        };

        config.validate();

        config
    }

    pub fn set_default_settings(&mut self) {
        let Self {
            path: _,
            path_err: _,
            available_ports: _,
            last_ports_scan: _,
            baud_rate,
            available_bauds: _,
            data_bits,
            flow_control,
            parity,
            stop_bits,
            send_data_delay,
            exclusive,
        } = self;

        *baud_rate = BaudRate::default();
        *data_bits = Self::DATA_BITS[0];
        *flow_control = Self::FLOW_CONTROL[0].to_owned();
        *parity = Self::PARITY[0].to_owned();
        *stop_bits = Self::STOP_BITS[0];
        *exclusive = Self::EXCLUSIVE[0].to_owned();
        *send_data_delay = Self::DELAY[0].to_owned();
    }

    pub fn validate(&mut self) {
        self.path_err = self
            .path
            .is_empty()
            .then_some("Parameter 'Path' can't be empty");
    }

    pub fn is_valid(&self) -> bool {
        self.path_err.is_none()
    }

    pub fn port_validation_err(&self) -> Option<&str> {
        self.path_err
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        if let Some(path_err) = self.path_err {
            vec![path_err]
        } else {
            Vec::new()
        }
    }

    pub fn check_update_ports(&mut self) {
        let check_duration = if self.available_ports.is_empty() {
            NOPORTS_RESCAN_PORTS_DURATION
        } else {
            REGULAR_RESCAN_PORTS_DURATION
        };

        if self.last_ports_scan.elapsed() > check_duration {
            self.available_ports = Self::scan_ports();
            self.last_ports_scan = Instant::now();
        }
    }

    fn scan_ports() -> Vec<String> {
        serialport::available_ports()
            .map(|ports| ports.into_iter().map(|port| port.port_name).collect_vec())
            .inspect_err(|err| log::warn!("Retrieving available ports failed with error: {err}"))
            .unwrap_or_default()
    }

    fn all_baud_rates() -> Vec<BaudRate> {
        vec![
            BaudRate::Custom(DEFAULT_BAUD_RATE),
            BaudRate::Predefined(50),
            BaudRate::Predefined(75),
            BaudRate::Predefined(110),
            BaudRate::Predefined(134),
            BaudRate::Predefined(150),
            BaudRate::Predefined(200),
            BaudRate::Predefined(300),
            BaudRate::Predefined(600),
            BaudRate::Predefined(1200),
            BaudRate::Predefined(1800),
            BaudRate::Predefined(2400),
            BaudRate::Predefined(4800),
            BaudRate::Predefined(9600),
            BaudRate::Predefined(19200),
            BaudRate::Predefined(38400),
            BaudRate::Predefined(57600),
            BaudRate::Predefined(115200),
            BaudRate::Predefined(230400),
            BaudRate::Predefined(460800),
            BaudRate::Predefined(500000),
            BaudRate::Predefined(576000),
            BaudRate::Predefined(921600),
            BaudRate::Predefined(1000000),
            BaudRate::Predefined(1152000),
            BaudRate::Predefined(1500000),
            BaudRate::Predefined(2000000),
            BaudRate::Predefined(2500000),
            BaudRate::Predefined(3000000),
            BaudRate::Predefined(3500000),
            BaudRate::Predefined(4000000),
        ]
    }
}

impl From<SerialConfig> for stypes::SerialTransportConfig {
    fn from(config: SerialConfig) -> Self {
        Self {
            path: config.path,
            baud_rate: match config.baud_rate {
                BaudRate::Custom(val) => val,
                BaudRate::Predefined(val) => val,
            },
            data_bits: config.data_bits,
            flow_control: config.flow_control.value,
            parity: config.parity.value,
            stop_bits: config.stop_bits,
            send_data_delay: config.send_data_delay.value,
            exclusive: config.exclusive.value,
        }
    }
}
