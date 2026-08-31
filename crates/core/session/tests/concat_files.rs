//! Contract tests for observing multiple concatenated files.

use std::{fs::read_to_string, io::Write};

use session::session::Session;
use stypes::{CallbackEvent, FileFormat, ObserveOptions, ObserveOrigin, ParserType};
use tempfile::NamedTempFile;
use uuid::Uuid;

/// The first file ends without a line break. Its last line must show up exactly once: a file
/// source that stops delivering is finished, so the session loop asks the parser to close the
/// item it is holding before it goes waiting.
#[tokio::test(flavor = "multi_thread")]
async fn line_without_trailing_break_survives_the_file_end() {
    let mut first = NamedTempFile::new().unwrap();
    write!(first, "first line\nsecond line").unwrap();
    first.flush().unwrap();

    let mut second = NamedTempFile::new().unwrap();
    writeln!(second, "third line").unwrap();
    second.flush().unwrap();

    let uuid = Uuid::new_v4();
    let (session, mut receiver) = Session::new(uuid).await.expect("Session should be created");

    let files = vec![
        (
            Uuid::new_v4().to_string(),
            FileFormat::Text,
            first.path().to_path_buf(),
        ),
        (
            Uuid::new_v4().to_string(),
            FileFormat::Text,
            second.path().to_path_buf(),
        ),
    ];

    session
        .observe(
            uuid,
            ObserveOptions {
                origin: ObserveOrigin::Concat(files),
                parser: ParserType::Text(()),
            },
        )
        .unwrap();

    // Each file reports `FileRead` on its own, so only the end of the operation means that all
    // of them have been written to the session file.
    while let Some(feedback) = receiver.recv().await {
        match feedback {
            CallbackEvent::OperationDone(_) => break,
            CallbackEvent::OperationError { error, .. } => {
                panic!("Received operation error: {error:#?}")
            }
            _ => {}
        }
    }

    let session_file = session
        .get_state()
        .get_session_file()
        .await
        .expect("We must have a session file after the observe session is done");
    let content = read_to_string(&session_file).expect("Session file can be read");

    session
        .stop(Uuid::new_v4())
        .await
        .expect("Session should stop after the session file is read");

    assert_eq!(
        content.lines().collect::<Vec<_>>(),
        ["first line", "second line", "third line"]
    );
}
