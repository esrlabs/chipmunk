mod utls;

use scopeguard::defer;
use sources::factory::{DltParserSettings, FileFormat, ParserType};
use utls::*;

#[tokio::test]
async fn observe_dlt_session() {
    let input = "../../../developing/resources/attachments.dlt";
    let parser_settings = DltParserSettings::default();
    let session_main_file = run_observe_session(
        input,
        FileFormat::Binary,
        ParserType::Dlt(DltParserSettings::default()),
    )
    .await;

    defer! { cleanup_session_files(&session_main_file)};

    let session_files = SessionFiles::from_session_file(&session_main_file);

    insta::with_settings!({
        info => &parser_settings,
        description => "Snapshot for DLT file with text attachments.",
        omit_expression => true,
        prepend_module_to_snapshot => false,
    }, {
        insta::assert_yaml_snapshot!(session_files);
    });
}
