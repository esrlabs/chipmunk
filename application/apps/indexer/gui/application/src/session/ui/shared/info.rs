use stypes::{ObserveOptions, ObserveOrigin};
use uuid::Uuid;

use crate::host::common::parsers::ParserNames;

#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: Uuid,
    pub title: String,
    pub parser: ParserNames,
    pub source: ObserveOrigin,
}

impl SessionInfo {
    pub fn from_observe_options(id: Uuid, options: &ObserveOptions) -> Self {
        let title = match &options.origin {
            ObserveOrigin::File(_, _, path) => path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| String::from("Unknown")),
            ObserveOrigin::Concat(..) => todo!("session info not implemented for concat"),
            ObserveOrigin::Stream(..) => todo!("session info not implemented for stream"),
        };

        let parser = ParserNames::from(&options.parser);
        let source = options.origin.clone();

        Self {
            title,
            id,
            parser,
            source,
        }
    }
}
