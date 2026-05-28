//! Snapshot tests for session output using `insta`.
//!
//! Snapshots are stored in `./snapshots/{test_name}.snap` and are part of the repository.
//! Valid snapshot changes must be reviewed and committed with the code that caused them.
//!
//! Run `just test-snapshots` to execute these tests in CI mode. CI mode fails on snapshot
//! mismatches without writing `{name}.snap.new` files.
//!
//! For local review of intentional changes, install `cargo-insta` and run `cargo insta review`.

mod utls;

use std::path::PathBuf;
use utls::*;

#[tokio::test]
async fn observe_dlt_session() {
    let input = "../../../development/resources/attachments.dlt";
    let parser_settings = stypes::DltParserSettings::default();
    let session_files = run_observe_session(
        input,
        stypes::FileFormat::Binary,
        stypes::ParserType::Dlt(parser_settings.clone()),
    )
    .await;

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
    let input = "../../../development/resources/someip.dlt";
    let fibex_file = "../../../development/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let parser_settings = stypes::DltParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
        ..Default::default()
    };

    let session_files = run_observe_session(
        input,
        stypes::FileFormat::Binary,
        stypes::ParserType::Dlt(parser_settings.clone()),
    )
    .await;

    insta::with_settings!({
        description => "Snapshot for DLT file with SomeIP network trace.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

// SomeIP request search in parsing session and searcher use block_in_place
// on CPU heavy blocks.
#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn observe_someip_bcapng_session() {
    let input = "../../../development/resources/someip.pcapng";
    let fibex_file = "../../../development/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let parser_settings = stypes::SomeIpParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
    };

    let session_files = run_observe_session(
        input,
        stypes::FileFormat::PcapNG,
        stypes::ParserType::SomeIp(parser_settings.clone()),
    )
    .await;

    insta::with_settings!({
        description => "Snapshot for SomeIP file with Pcapng byte source.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

// SomeIP request search in parsing session and searcher use block_in_place
// on CPU heavy blocks.
#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn observe_someip_legacy_session() {
    let input = "../../../development/resources/someip.pcap";
    let fibex_file = "../../../development/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let parser_settings = stypes::SomeIpParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
    };

    let session_files = run_observe_session(
        input,
        stypes::FileFormat::PcapLegacy,
        stypes::ParserType::SomeIp(parser_settings.clone()),
    )
    .await;

    insta::with_settings!({
        description => "Snapshot for SomeIP file with Pcap Legacy byte source.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}
