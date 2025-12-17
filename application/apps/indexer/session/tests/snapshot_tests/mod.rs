//! Snapshot testing is set here using the crate `insta` and optionally its CLI tool `cargo-insta`.
//!
//! Each test will created a snapshot file for its results, which will be saved with the path
//! './snapshots/{test_name}.snap'. These files will be used as reference for future tests then
//! tests will fail on changes.
//! Changes can be seen in our build CLI tool and can be accepted via CLI arguments, however it's
//! better to use the CLI tool `cargo insta` because it's output is colored and more clear compared
//! to the build CLI tool and it provides the possibility to review and accept each change one by
//! one, on the contrary to our build tool than can only accept all changes at once.
//!
//! Snapshot files are parts of the repository and valid changes in them must be committed as well.
//!
//! Running the tests via `cargo test` will create temporary files with the name pattern
//! '{name}.snap.new'. These files are used by `cargo-insta` tool and they aren't part of the
//! repo history.
//! Running the tests via `cargo chipmunk test` will avoid creating these temporary files.

mod utls;

use std::path::PathBuf;
use utls::*;

#[tokio::test]
async fn observe_dlt_session() {
    let input = "../../../developing/resources/attachments.dlt";
    let parser_settings = stypes::DltParserSettings::default();
    let session_main_file = run_observe_session(
        input,
        stypes::FileFormat::Binary,
        stypes::ParserType::Dlt(parser_settings.clone()),
    )
    .await;

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

    let parser_settings = stypes::DltParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
        ..Default::default()
    };

    let session_main_file = run_observe_session(
        input,
        stypes::FileFormat::Binary,
        stypes::ParserType::Dlt(parser_settings.clone()),
    )
    .await;

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

// SomeIP request search in parsing session and searcher use block_in_place
// on CPU heavy blocks.
#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn observe_someip_bcapng_session() {
    let input = "../../../developing/resources/someip.pcapng";
    let fibex_file = "../../../developing/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let parser_settings = stypes::SomeIpParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
    };

    let session_main_file = run_observe_session(
        input,
        stypes::FileFormat::PcapNG,
        stypes::ParserType::SomeIp(parser_settings.clone()),
    )
    .await;

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

// SomeIP request search in parsing session and searcher use block_in_place
// on CPU heavy blocks.
#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn observe_someip_legacy_session() {
    let input = "../../../developing/resources/someip.pcap";
    let fibex_file = "../../../developing/resources/someip.xml";

    assert!(
        PathBuf::from(fibex_file).exists(),
        "Fibex file path doesn't exist. Path: {fibex_file}"
    );

    let parser_settings = stypes::SomeIpParserSettings {
        fibex_file_paths: Some(vec![String::from(fibex_file)]),
    };

    let session_main_file = run_observe_session(
        input,
        stypes::FileFormat::PcapLegacy,
        stypes::ParserType::SomeIp(parser_settings.clone()),
    )
    .await;

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for SomeIP file with Pcap Legacy byte source.",
        info => &parser_settings,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}
