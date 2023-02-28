use super::folder::get_folder_content;
use log::debug;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum Command {
    FolderContent(String, mpsc::Sender<(Uuid, String)>),
}

pub async fn process(command: Command, uuid: Uuid, cancel: CancellationToken) {
    match command {
        Command::FolderContent(path, tx) => {
            let res = get_folder_content(&path, cancel);
            debug!("command result: {res}");
            let _ = tx.send((uuid, res)).await;
        }
    }
}
