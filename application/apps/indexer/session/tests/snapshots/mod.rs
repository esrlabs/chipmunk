// TODO AAZ: Remove after prototyping
#![allow(unused)]

mod utls;

use pretty_assertions::{assert_eq, assert_ne};
use sources::factory::{DltParserSettings, FileFormat, ParserType};
use utls::*;

#[tokio::test]
async fn export_dlt() {
    let input = "../../../developing/resources/attachments.dlt";
    let session_file = run_export(
        input,
        FileFormat::Binary,
        ParserType::Dlt(DltParserSettings::default()),
    )
    .await;

    panic!("Session file: {}", session_file.display());
}
