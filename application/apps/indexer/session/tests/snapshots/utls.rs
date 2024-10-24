use session::{events::CallbackEvent, session::Session};
use sources::factory::{FileFormat, ObserveOptions, ParserType};
use std::path::PathBuf;
use uuid::Uuid;

pub struct MyStruct;

pub async fn run_export<P: Into<PathBuf>>(
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
            CallbackEvent::SessionError(err) => panic!("Recieved session error: {err:#?}"),
            CallbackEvent::OperationError { error, .. } => {
                panic!("Recieved operation error: {error:#?}")
            }
            _ => {}
        }
    }

    let file = session.get_state().get_session_file().await.unwrap();
    //TODO AAZ: Remove after Debug
    println!("SESSOIN FILE: {}", file.display());

    file
}
