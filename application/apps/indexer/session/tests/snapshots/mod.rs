// TODO AAZ: Remove after prototyping
#![allow(unused)]

mod utls;

use pretty_assertions::{assert_eq, assert_ne};
use scopeguard::defer;
use sources::factory::{DltParserSettings, FileFormat, ParserType};
use utls::*;

#[tokio::test]
async fn export_dlt() {
    let input = "../../../developing/resources/attachments.dlt";
    let session_main_file = run_observe_session(
        input,
        FileFormat::Binary,
        ParserType::Dlt(DltParserSettings::default()),
    )
    .await;

    defer! { cleanup_session_file(&session_main_file)};

    let session_files = SessionFiles::from_session_file(&session_main_file);

    panic!("{:#?}", session_files);
}
