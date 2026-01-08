use std::fmt::Display;

use crate::host::{common::parsers::ParserNames, ui::session_setup::state::sources::StreamConfig};

/// Slim variant of [`stypes::Transport`] without their configurations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamNames {
    Process,
    Tcp,
    Udp,
    Serial,
}

impl StreamNames {
    pub const fn all() -> &'static [StreamNames] {
        // Reminder to add on new types
        match StreamNames::Process {
            StreamNames::Process => {}
            StreamNames::Tcp => {}
            StreamNames::Udp => {}
            StreamNames::Serial => {}
        };

        &[
            StreamNames::Process,
            StreamNames::Tcp,
            StreamNames::Udp,
            StreamNames::Serial,
        ]
    }

    pub fn is_compatible(self, parser: ParserNames) -> bool {
        parser.is_compatible(self)
    }
}

impl Display for StreamNames {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            StreamNames::Process => "Terminal",
            StreamNames::Tcp => "TCP",
            StreamNames::Udp => "UDP",
            StreamNames::Serial => "Serial Port",
        };

        f.write_str(name)
    }
}

impl From<&StreamConfig> for StreamNames {
    fn from(value: &StreamConfig) -> Self {
        match value {
            StreamConfig::Process(..) => Self::Process,
            StreamConfig::Tcp(..) => Self::Tcp,
            StreamConfig::Udp(..) => Self::Udp,
            StreamConfig::Serial => Self::Serial,
        }
    }
}
