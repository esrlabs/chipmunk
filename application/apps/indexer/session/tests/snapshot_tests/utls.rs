use serde::{Deserialize, Serialize};
use session::{events::CallbackEvent, session::Session};
use sources::factory::{FileFormat, ObserveOptions, ParserType};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
/// Represents the files generated while parsing a file in an observe session.
/// # Note:
/// This struct it made for testing purposes with snapshots.
pub struct SessionFiles {
    /// The content of the main session file, normally with name `{uuid}.session`
    /// Content saved as line for better comparison in testing.
    #[serde(rename = "session_file")]
    pub session_file_lines: Vec<String>,
    /// The generated files for the attachments in the attachments directory with the name `{uuid}`
    pub attachments: Vec<AttachmentInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
/// Represents an attachment file in process observe session.
pub struct AttachmentInfo {
    pub filename: String,
    /// Content of the file when it has textual content. For binary format it will stay empty.
    /// Content saved as line for better comparison in testing.
    #[serde(rename = "content")]
    pub content_lines: Vec<String>,
}

impl SessionFiles {
    /// Creates a session files infos reading the main session file and the attachments if exists.
    pub fn from_session_file(session_file: &Path) -> Self {
        assert!(
            session_file.exists(),
            "Session file doesn't exist. Path: {}",
            session_file.display()
        );

        let session_file_lines = std::fs::read_to_string(session_file)
            .expect("Session file can be read to string without problems")
            .lines()
            .map(ToString::to_string)
            .collect();

        let session_dir = session_dir_form_file(session_file);

        let mut attachments = Vec::new();

        if session_dir.is_dir() {
            let atts_iter = session_dir
                .read_dir()
                .unwrap()
                .flat_map(Result::ok)
                .map(|entry| entry.path())
                .map(|entry_path| AttachmentInfo {
                    filename: entry_path
                        .file_name()
                        .unwrap()
                        .to_string_lossy()
                        .to_string(),
                    content_lines: std::fs::read_to_string(entry_path)
                        .map(|content| content.lines().map(ToString::to_string).collect())
                        .unwrap_or_default(), // Use empty content for binary files.
                });

            attachments.extend(atts_iter);
        }

        attachments.sort_by(|att1, att2| att1.filename.cmp(&att2.filename));

        Self {
            session_file_lines,
            attachments,
        }
    }
}

/// Provide the name of the attachments directory for the given session main file.
fn session_dir_form_file(session_file: &Path) -> PathBuf {
    const SESSION_FILE_SUFFIX: &str = ".session";

    session_file
        .to_str()
        .and_then(|file| file.strip_suffix(SESSION_FILE_SUFFIX))
        .map(PathBuf::from)
        .expect("Session path can't fail while converting to string")
}

/// Runs a processor observe session generating the session files in Chipmunk temporary directory
/// and returning the path of the main session file.
/// # Note:
/// This function it made for test purposes with snapshots.
pub async fn run_observe_session<P: Into<PathBuf>>(
    input: P,
    file_format: FileFormat,
    parser_type: ParserType,
) -> PathBuf {
    let input: PathBuf = input.into();

    assert!(
        input.exists(),
        "Input file doesn't exist. Path {}",
        input.display()
    );

    let uuid = Uuid::new_v4();
    let (session, mut receiver) = Session::new(uuid).await.expect("Session should be created");

    session
        .observe(
            uuid,
            ObserveOptions::file(input.clone(), file_format, parser_type),
        )
        .unwrap();

    while let Some(feedback) = receiver.recv().await {
        match feedback {
            CallbackEvent::FileRead | CallbackEvent::SessionDestroyed => break,
            CallbackEvent::SessionError(err) => panic!("Received session error: {err:#?}"),
            CallbackEvent::OperationError { error, .. } => {
                panic!("Received operation error: {error:#?}")
            }
            _ => {}
        }
    }

    session
        .get_state()
        .get_session_file()
        .await
        .expect("We must have a session file after observe session is done")
}
