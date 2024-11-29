use processor::search::filter::SearchFilter;
use serde::{de::DeserializeOwned, Serialize};
use tokio::sync::{mpsc::UnboundedSender, oneshot};

use super::commands::Command;

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

    pub async fn shutdown(&self) -> Result<(), stypes::ComputationError> {
        let (tx, rx): (oneshot::Sender<()>, oneshot::Receiver<()>) = oneshot::channel();
        self.tx.send(API::Shutdown(tx)).map_err(|_| {
            stypes::ComputationError::Communication(String::from("Fail to send API::Shutdown"))
        })?;
        rx.await.map_err(|e| {
            stypes::ComputationError::Communication(format!(
                "Fail to get response from API::Shutdown: {e:?}"
            ))
        })
    }

    pub async fn cancel_job(&self, operation_id: &u64) -> Result<(), stypes::ComputationError> {
        self.tx.send(API::CancelJob(*operation_id)).map_err(|_| {
            stypes::ComputationError::Communication(String::from("Fail to send API::CancelJob"))
        })
    }

    async fn process_command<T: Serialize + DeserializeOwned>(
        &self,
        id: u64,
        rx_results: oneshot::Receiver<Result<stypes::CommandOutcome<T>, stypes::ComputationError>>,
        command: Command,
    ) -> Result<stypes::CommandOutcome<T>, stypes::ComputationError> {
        let cmd = command.to_string();
        self.tx.send(API::Run(command, id)).map_err(|_| {
            stypes::ComputationError::Communication(format!("Fail to send call {cmd}"))
        })?;
        rx_results
            .await
            .map_err(|e| stypes::ComputationError::Communication(format!("channel error: {e}")))?
    }

    pub(crate) fn remove_command(&self, id: u64) -> Result<(), stypes::ComputationError> {
        self.tx.send(API::Remove(id)).map_err(|_| {
            stypes::ComputationError::Communication(format!("Fail to remove command id={id}"))
        })?;
        Ok(())
    }

    pub async fn cancel_test(
        &self,
        id: u64,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<stypes::CommandOutcome<i64>, stypes::ComputationError> {
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
    ) -> Result<stypes::CommandOutcome<stypes::FoldersScanningResult>, stypes::ComputationError>
    {
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

    pub async fn is_file_binary(
        &self,
        id: u64,
        file_path: String,
    ) -> Result<stypes::CommandOutcome<bool>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::IsFileBinary(file_path, tx_results))
            .await
    }

    pub async fn spawn_process(
        &self,
        id: u64,
        path: String,
        args: Vec<String>,
    ) -> Result<stypes::CommandOutcome<()>, stypes::ComputationError> {
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
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::Checksum(path, tx_results))
            .await
    }

    pub async fn get_dlt_stats(
        &self,
        id: u64,
        files: Vec<String>,
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetDltStats(files, tx_results))
            .await
    }

    pub async fn get_someip_statistic(
        &self,
        id: u64,
        files: Vec<String>,
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
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
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetShellProfiles(tx_results))
            .await
    }

    pub async fn get_context_envvars(
        &self,
        id: u64,
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetContextEnvvars(tx_results))
            .await
    }

    pub async fn get_serial_ports_list(
        &self,
        id: u64,
    ) -> Result<stypes::CommandOutcome<stypes::SerialPortsList>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::SerialPortsList(tx_results))
            .await
    }

    pub async fn get_regex_error(
        &self,
        id: u64,
        filter: SearchFilter,
    ) -> Result<stypes::CommandOutcome<Option<String>>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::GetRegexError(filter, tx_results))
            .await
    }

    pub async fn sleep(
        &self,
        id: u64,
        ms: u64,
    ) -> Result<stypes::CommandOutcome<()>, stypes::ComputationError> {
        let (tx_results, rx_results) = oneshot::channel();
        self.process_command(id, rx_results, Command::Sleep(ms, tx_results))
            .await
    }
}
