use crate::events::ComputationError;
use futures::Future;
use serde::Serialize;
use tokio::sync::{mpsc::UnboundedSender, oneshot};
use uuid::Uuid;

use super::commands::{Command, CommandOutcome};

#[derive(Debug)]
pub enum API {
    Shutdown(oneshot::Sender<()>),
    CancelJob(Uuid),
    Run(Command, Uuid),
}

#[derive(Clone, Debug)]
pub struct UnboundSessionAPI {
    tx: UnboundedSender<API>,
}

impl UnboundSessionAPI {
    pub fn new(tx: UnboundedSender<API>) -> Self {
        Self { tx }
    }

    pub async fn shutdown(&self) -> Result<(), ComputationError> {
        let (tx, rx): (oneshot::Sender<()>, oneshot::Receiver<()>) = oneshot::channel();
        self.tx.send(API::Shutdown(tx)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send API::Shutdown"))
        })?;
        rx.await.map_err(|e| {
            ComputationError::Communication(format!(
                "Fail to get response from API::Shutdown: {e:?}"
            ))
        })
    }

    pub async fn cancel_job(&self, operation_uuid: &Uuid) -> Result<(), ComputationError> {
        self.tx.send(API::CancelJob(*operation_uuid)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send API::CancelJob"))
        })
    }

    async fn process_command<T: Serialize>(
        &self,
        uuid: Uuid,
        rx_results: oneshot::Receiver<Result<CommandOutcome<T>, ComputationError>>,
        command: Command,
    ) -> Result<CommandOutcome<T>, ComputationError> {
        println!("indexer: process command for {command}");
        self.tx.send(API::Run(command, uuid)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send call Job::SomeJob"))
        })?;
        rx_results
            .await
            .map_err(|e| ComputationError::Communication(format!("channel error: {e}")))?
    }

    pub fn cancel_test(
        &self,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> (
        impl Future<Output = Result<CommandOutcome<i64>, ComputationError>> + '_,
        Uuid,
    ) {
        let uuid = Uuid::new_v4();
        (
            async move {
                let (tx_results, rx_results) = oneshot::channel();
                self.process_command(
                    uuid,
                    rx_results,
                    Command::CancelTest(custom_arg_a, custom_arg_b, tx_results),
                )
                .await
            },
            uuid,
        )
    }

    pub fn list_folder_content(
        &self,
        path: String,
    ) -> (
        impl Future<Output = Result<CommandOutcome<String>, ComputationError>> + '_,
        Uuid,
    ) {
        let uuid = Uuid::new_v4();
        (
            async move {
                println!("indexer: list_folder_content");
                let (tx_results, rx_results) = oneshot::channel();
                self.process_command(uuid, rx_results, Command::FolderContent(path, tx_results))
                    .await
            },
            uuid,
        )
    }
}
