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
use stypes::{SessionAction, SessionSetup};
use utls::*;

#[tokio::test]
async fn observe_dlt_session() {
    let setup = SessionSetup {
        origin: SessionAction::File(PathBuf::from(
            "../../../developing/resources/attachments.dlt",
        )),
        parser: parsers::dlt::descriptor::get_default_options(None, None),
        source: sources::binary::raw::get_default_options(),
    };
    let session_main_file = run_observe_session(setup.clone()).await;

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for DLT file with text attachments.",
        info => &setup,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

#[tokio::test]
async fn observe_dlt_with_someip_session() {
    let setup = SessionSetup {
        origin: SessionAction::File(PathBuf::from("../../../developing/resources/someip.dlt")),
        parser: parsers::dlt::descriptor::get_default_options(
            Some(vec![PathBuf::from(
                "../../../developing/resources/someip.xml",
            )]),
            None,
        ),
        source: sources::binary::raw::get_default_options(),
    };
    let session_main_file = run_observe_session(setup.clone()).await;

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for DLT file with SomeIP network trace.",
        info => &setup,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

#[tokio::test]
async fn observe_someip_bcapng_session() {
    let setup = SessionSetup {
        origin: SessionAction::File(PathBuf::from("../../../developing/resources/someip.pcapng")),
        parser: parsers::someip::descriptor::get_default_options(Some(vec![PathBuf::from(
            "../../../developing/resources/someip.xml",
        )])),
        source: sources::binary::pcap::ng::get_default_options(),
    };

    let session_main_file = run_observe_session(setup.clone()).await;

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for SomeIP file with Pcapng byte source.",
        info => &setup,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}

#[tokio::test]
async fn observe_someip_legacy_session() {
    let setup = SessionSetup {
        origin: SessionAction::File(PathBuf::from("../../../developing/resources/someip.pcap")),
        parser: parsers::someip::descriptor::get_default_options(Some(vec![PathBuf::from(
            "../../../developing/resources/someip.xml",
        )])),
        source: sources::binary::pcap::legacy::get_default_options(),
    };

    let session_main_file = run_observe_session(setup.clone()).await;

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        description => "Snapshot for SomeIP file with Pcap Legacy byte source.",
        info => &setup,
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}
