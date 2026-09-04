//! Contract tests for text files, which are parsed by the tokenizer like any other source
//! instead of being read as session content directly.

use std::{fs::read_to_string, io::Write, path::Path, time::Duration};

use session::session::Session;
use stypes::{CallbackEvent, FileFormat, ObserveOptions, ObserveOrigin, ParserType};
use tempfile::NamedTempFile;
use tokio::sync::mpsc::UnboundedReceiver;
use uuid::Uuid;

/// Waits until one of the session events matches `is_expected`, treating operation errors and a
/// session which stops reporting as test failures: a stalled session must fail instead of
/// blocking the test run.
async fn wait_for_event(
    receiver: &mut UnboundedReceiver<CallbackEvent>,
    mut is_expected: impl FnMut(&CallbackEvent) -> bool,
) {
    let waiting = async {
        while let Some(feedback) = receiver.recv().await {
            if let CallbackEvent::OperationError { error, .. } = &feedback {
                panic!("Received operation error: {error:#?}");
            }
            if is_expected(&feedback) {
                return;
            }
        }
        panic!("Session stopped sending events before the expected one arrived");
    };

    tokio::time::timeout(Duration::from_secs(30), waiting)
        .await
        .expect("Expected event must arrive");
}

/// Observes `path` with the text parser and waits until its content has been read into the
/// session file.
async fn observe_text_file(path: &Path) -> (Session, UnboundedReceiver<CallbackEvent>) {
    let uuid = Uuid::new_v4();
    let (session, mut receiver) = Session::new(uuid).await.expect("Session should be created");

    session
        .observe(
            uuid,
            ObserveOptions::file(path.to_path_buf(), FileFormat::Text, ParserType::Text(())),
        )
        .unwrap();

    wait_for_event(&mut receiver, |feedback| {
        matches!(feedback, CallbackEvent::FileRead)
    })
    .await;

    (session, receiver)
}

/// Content of the session file, which holds the parsed content of all sources of the session.
async fn session_file_content(session: &Session) -> String {
    let session_file = session
        .get_state()
        .get_session_file()
        .await
        .expect("We must have a session file after content has been read");

    read_to_string(session_file).expect("Session file can be read")
}

/// The first file ends without a line break. Its last line must show up exactly once: a file
/// source that stops delivering is finished, so the session loop asks the parser to close the
/// item it is holding before it goes waiting.
#[tokio::test]
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
    wait_for_event(&mut receiver, |feedback| {
        matches!(feedback, CallbackEvent::OperationDone(_))
    })
    .await;

    let content = session_file_content(&session).await;

    session
        .stop(Uuid::new_v4())
        .await
        .expect("Session should stop after the session file is read");

    assert_eq!(
        content.lines().collect::<Vec<_>>(),
        ["first line", "second line", "third line"]
    );
}

/// Bytes which aren't valid UTF-8 are decoded lossily instead of refusing the file, and only
/// the affected characters are lost. The invalid byte sits behind more than 10 KiB of valid
/// content, the amount an encoding check at open time would have looked at.
#[tokio::test]
async fn invalid_bytes_become_replacement_characters() {
    let padding: String = (0..200)
        .map(|line| format!("padding line {line:0>50}\n"))
        .collect();
    assert!(padding.len() > 10240);

    let mut file = NamedTempFile::new().unwrap();
    file.write_all(padding.as_bytes()).unwrap();
    file.write_all(b"tama\xf1o\n").unwrap();
    file.write_all(b"after invalid byte\n").unwrap();
    file.flush().unwrap();

    let (session, _receiver) = observe_text_file(file.path()).await;
    let content = session_file_content(&session).await;
    session.stop(Uuid::new_v4()).await.unwrap();

    let lines: Vec<_> = content.lines().collect();
    assert_eq!(lines.len(), 202);
    assert_eq!(
        lines[199],
        "padding line 00000000000000000000000000000000000000000000000199"
    );
    assert_eq!(lines[200], "tama\u{FFFD}o");
    assert_eq!(lines[201], "after invalid byte");
}

/// The byte order mark of a UTF-8 file is not content: it used to show up as `U+FEFF` at the
/// start of the first line.
#[tokio::test]
async fn utf8_byte_order_mark_is_skipped() {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "\u{FEFF}first line").unwrap();
    file.flush().unwrap();

    let (session, _receiver) = observe_text_file(file.path()).await;
    let content = session_file_content(&session).await;
    session.stop(Uuid::new_v4()).await.unwrap();

    assert_eq!(content, "first line\n");
}

/// Content appended after the initial pass is parsed as well, so a growing file keeps the
/// session up to date.
#[tokio::test]
async fn appended_lines_are_picked_up() {
    let mut file = NamedTempFile::new().unwrap();
    writeln!(file, "first line").unwrap();
    file.flush().unwrap();

    let (session, mut receiver) = observe_text_file(file.path()).await;

    writeln!(file, "second line").unwrap();
    file.flush().unwrap();

    wait_for_event(
        &mut receiver,
        |feedback| matches!(feedback, CallbackEvent::StreamUpdated(rows) if *rows >= 2),
    )
    .await;

    let content = session_file_content(&session).await;
    session.stop(Uuid::new_v4()).await.unwrap();

    assert_eq!(content, "first line\nsecond line\n");
}
