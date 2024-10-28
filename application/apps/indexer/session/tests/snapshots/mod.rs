mod utls;

use std::path::PathBuf;

use scopeguard::defer;
use sources::factory::{DltParserSettings, FileFormat, ParserType, SomeIpParserSettings};
use utls::*;

#[tokio::test]
async fn observe_dlt_session() {
    let input = "../../../developing/resources/attachments.dlt";
    let parser_settings = DltParserSettings::default();
    let session_main_file = run_observe_session(
        input,
        FileFormat::Binary,
        ParserType::Dlt(parser_settings.clone()),
    )
    .await;

    defer! { cleanup_session_files(&session_main_file)};

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for DLT file with text attachments.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

#[tokio::test]
async fn observe_dlt_with_someip_session() {
    let input = "../../../developing/resources/someip.dlt";
    let fibex_file = "../../../developing/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let mut parser_settings = DltParserSettings::default();
    parser_settings.fibex_file_paths = Some(vec![String::from(fibex_file)]);

    let session_main_file = run_observe_session(
        input,
        FileFormat::Binary,
        ParserType::Dlt(parser_settings.clone()),
    )
    .await;

    defer! { cleanup_session_files(&session_main_file)};

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for DLT file with SomeIP network trace.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

#[tokio::test]
async fn observe_someip_bcapng_session() {
    let input = "../../../developing/resources/someip.pcapng";
    let fibex_file = "../../../developing/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let parser_settings = SomeIpParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
    };

    let session_main_file = run_observe_session(
        input,
        FileFormat::PcapNG,
        ParserType::SomeIp(parser_settings.clone()),
    )
    .await;

    defer! { cleanup_session_files(&session_main_file)};

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for SomeIP file with Pcapng byte source.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}
