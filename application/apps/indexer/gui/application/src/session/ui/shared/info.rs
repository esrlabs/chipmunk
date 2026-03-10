use stypes::{ObserveOptions, ObserveOrigin, Transport};
use uuid::Uuid;

use crate::{host::common::parsers::ParserNames, session::ui::shared::ObserveState};

#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: Uuid,
    pub title: String,
    pub parser: ParserNames,
}

impl SessionInfo {
    pub fn from_observe_options(id: Uuid, options: &ObserveOptions) -> Self {
        let title = match &options.origin {
            ObserveOrigin::File(_, _, path) => path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| String::from("Unknown")),
            ObserveOrigin::Concat(files) => concat_title(files.len()),
            ObserveOrigin::Stream(_id, transport) => match transport {
                Transport::Process(config) => config.command.to_owned(),
                Transport::TCP(config) => config.bind_addr.to_owned(),
                Transport::UDP(config) => config.bind_addr.to_owned(),
                Transport::Serial(config) => config.path.to_owned(),
            },
        };

        let parser = ParserNames::from(&options.parser);

        Self { title, id, parser }
    }

    pub fn update_title(&mut self, state: &ObserveState) {
        let Some(first_op) = state.operations().first() else {
            return;
        };

        match &first_op.origin {
            ObserveOrigin::File(..) => {}
            ObserveOrigin::Concat(..) => self.title = concat_title(state.sources_count()),
            ObserveOrigin::Stream(_, transport) => {
                let count = state.sources_count();
                self.title = match transport {
                    Transport::Process(..) => format!("{count} Terminal Commands"),
                    Transport::TCP(..) => format!("{count} TCP Connections"),
                    Transport::UDP(..) => format!("{count} UDP Connections"),
                    Transport::Serial(..) => format!("{count} Serial Connections"),
                }
            }
        }
    }
}

fn concat_title(files_count: usize) -> String {
    format!("Concating {files_count} files")
}
