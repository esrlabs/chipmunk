use crate::events::ComputationError;
use serde::Serialize;
use tokio::sync::{mpsc::UnboundedSender, oneshot};
use uuid::Uuid;

use super::commands::{Command, CommandOutcome};

#[derive(Debug)]
pub enum API {
    Shutdown(oneshot::Sender<()>),
    CancelJob(Uuid),
    Run(Command, oneshot::Sender<Uuid>),
}

#[derive(Clone, Debug)]
pub struct SessionAPI {
    tx: UnboundedSender<API>,
}

impl SessionAPI {
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

    async fn process_command<F: Fn(String) + Send + 'static, T: Serialize>(
        &self,
        send_operation_uuid: F,
        rx_results: oneshot::Receiver<Result<CommandOutcome<T>, ComputationError>>,
        command: Command,
    ) -> Result<CommandOutcome<T>, ComputationError> {
        let (tx_uuid, rx_uuid) = oneshot::channel();
        self.tx.send(API::Run(command, tx_uuid)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send call Job::SomeJob"))
        })?;
        let uuid = rx_uuid.await.map_err(|_| {
            ComputationError::Communication(String::from("Fail to get uuid of Job::SomeJob"))
        })?;
        send_operation_uuid(uuid.to_string());
        rx_results
            .await
            .map_err(|e| ComputationError::Communication(format!("channel error: {e}")))?
    }

    pub async fn cancel_test<F: Fn(String) + Send + 'static>(
        &self,
        send_operation_uuid: F,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<CommandOutcome<i64>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(
            send_operation_uuid,
            rx_results,
            Command::CancelTest(custom_arg_a, custom_arg_b, tx_results),
        )
        .await
    }

    pub async fn list_folder_content<F: Fn(String) + Send + 'static>(
        &self,
        send_operation_uuid: F,
        path: String,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(
            send_operation_uuid,
            rx_results,
            Command::FolderContent(path, tx_results),
        )
        .await
    }
}
