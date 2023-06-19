use crate::events::ComputationError;
use processor::search::filter::SearchFilter;
use serde::Serialize;
use tokio::sync::{mpsc::UnboundedSender, oneshot};

use super::commands::{Command, CommandOutcome};

#[derive(Debug)]
pub enum API {
    Shutdown(oneshot::Sender<()>),
    CancelJob(u64),
    Run(Command, u64),
    /// remove finished jobs from registry
    Remove(u64),
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

    pub async fn cancel_job(&self, operation_id: &u64) -> Result<(), ComputationError> {
        self.tx.send(API::CancelJob(*operation_id)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send API::CancelJob"))
        })
    }

    async fn process_command<T: Serialize>(
        &self,
        id: u64,
        rx_results: oneshot::Receiver<Result<CommandOutcome<T>, ComputationError>>,
        command: Command,
    ) -> Result<CommandOutcome<T>, ComputationError> {
        self.tx.send(API::Run(command, id)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send call Job::SomeJob"))
        })?;
        rx_results
            .await
            .map_err(|e| ComputationError::Communication(format!("channel error: {e}")))?
    }

    pub(crate) fn remove_command(&self, id: u64) -> Result<(), ComputationError> {
        self.tx.send(API::Remove(id)).map_err(|_| {
            ComputationError::Communication(String::from("Fail to send call Job::SomeJob"))
        })?;
        Ok(())
    }

    pub async fn cancel_test(
        &self,
        id: u64,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<CommandOutcome<i64>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(
            id,
            rx_results,
            Command::CancelTest(custom_arg_a, custom_arg_b, tx_results),
        )
        .await
    }

    pub async fn list_folder_content(
        &self,
        id: u64,
        depth: usize,
        max_len: usize,
        paths: Vec<String>,
        include_files: bool,
        include_folders: bool,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(
            id,
            rx_results,
            Command::FolderContent(
                paths,
                depth,
                max_len,
                include_files,
                include_folders,
                tx_results,
            ),
        )
        .await
    }

    pub async fn spawn_process(
        &self,
        id: u64,
        path: String,
        args: Vec<String>,
    ) -> Result<CommandOutcome<()>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(
            id,
            rx_results,
            Command::SpawnProcess(path, args, tx_results),
        )
        .await
    }

    pub async fn get_file_checksum(
        &self,
        id: u64,
        path: String,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::Checksum(path, tx_results))
            .await
    }

    pub async fn get_dlt_stats(
        &self,
        id: u64,
        files: Vec<String>,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetDltStats(files, tx_results))
            .await
    }

    pub async fn get_someip_statistic(
        &self,
        id: u64,
        files: Vec<String>,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(
            id,
            rx_results,
            Command::GetSomeipStatistic(files, tx_results),
        )
        .await
    }

    pub async fn get_shell_profiles(
        &self,
        id: u64,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetShellProfiles(tx_results))
            .await
    }

    pub async fn get_context_envvars(
        &self,
        id: u64,
    ) -> Result<CommandOutcome<String>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetContextEnvvars(tx_results))
            .await
    }

    pub async fn get_serial_ports_list(
        &self,
        id: u64,
    ) -> Result<CommandOutcome<Vec<String>>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::SerialPortsList(tx_results))
            .await
    }

    pub async fn get_regex_error(
        &self,
        id: u64,
        filter: SearchFilter,
    ) -> Result<CommandOutcome<Option<String>>, ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetRegexError(filter, tx_results))
            .await
    }
}
