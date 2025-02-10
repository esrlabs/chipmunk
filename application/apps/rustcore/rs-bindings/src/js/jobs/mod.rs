use crate::js::converting::filter::WrappedSearchFilter;
use log::{debug, error};
use node_bindgen::derive::node_bindgen;

use session::unbound::{api::UnboundSessionAPI, UnboundSession};
use std::{convert::TryFrom, thread};
use tokio::runtime::Runtime;
use tokio_util::sync::CancellationToken;

struct UnboundJobs {
    api: Option<UnboundSessionAPI>,
    finished: CancellationToken,
}

fn u64_from_i64(id: i64) -> Result<u64, stypes::ComputationError> {
    u64::try_from(id)
        .map_err(|_| stypes::ComputationError::InvalidArgs(String::from("ID of job is invalid")))
}

fn usize_from_i64(id: i64) -> Result<usize, stypes::ComputationError> {
    usize::try_from(id).map_err(|_| {
        stypes::ComputationError::InvalidArgs(String::from("Fail to conver i64 to usize"))
    })
}

#[node_bindgen]
impl UnboundJobs {
    // Self methods
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            api: None,
            finished: CancellationToken::new(),
        }
    }

    #[node_bindgen(mt)]
    async fn init(&mut self) -> Result<(), stypes::ComputationError> {
        let rt = Runtime::new().map_err(|e| {
            stypes::ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;

        let (mut session, api) = UnboundSession::new();
        self.api = Some(api);
        let confirmation = self.finished.clone();
        thread::spawn(move || {
            rt.block_on(async {
                if let Err(err) = session.init().await {
                    error!("Fail to init unbound session: {err}");
                } else {
                    debug!("Unbound session is started");
                    session.finished.cancelled().await;
                    confirmation.cancel();
                    debug!("Unbound session is closed");
                }
            })
        });
        Ok(())
    }

    #[node_bindgen]
    async fn destroy(&self) -> Result<(), stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .shutdown()
            .await?;
        self.finished.cancelled().await;
        Ok(())
    }

    /// Cancel given operation/task
    #[node_bindgen]
    async fn abort(&self, id: i64) -> Result<(), stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .cancel_job(&u64_from_i64(id)?)
            .await
    }

    // Custom methods (jobs)
    #[node_bindgen]
    async fn list_folder_content(
        &self,
        id: i64,
        depth: i64,
        max_len: i64,
        paths: Vec<String>,
        include_files: bool,
        include_folders: bool,
    ) -> Result<stypes::CommandOutcome<stypes::FoldersScanningResult>, stypes::ComputationError>
    {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .list_folder_content(
                u64_from_i64(id)?,
                usize_from_i64(depth)?,
                usize_from_i64(max_len)?,
                paths,
                include_files,
                include_folders,
            )
            .await
    }

    #[node_bindgen]
    async fn is_file_binary(
        &self,
        id: i64,
        file_path: String,
    ) -> Result<stypes::CommandOutcome<bool>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .is_file_binary(u64_from_i64(id)?, file_path)
            .await
    }

    #[node_bindgen]
    async fn spawn_process(
        &self,
        id: i64,
        path: String,
        args: Vec<String>,
    ) -> Result<stypes::CommandOutcome<()>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .spawn_process(u64_from_i64(id)?, path, args)
            .await
    }

    #[node_bindgen]
    async fn get_file_checksum(
        &self,
        id: i64,
        path: String,
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_file_checksum(u64_from_i64(id)?, path)
            .await
    }

    #[node_bindgen]
    async fn get_dlt_stats(
        &self,
        id: i64,
        files: Vec<String>,
    ) -> Result<stypes::CommandOutcome<stypes::DltStatisticInfo>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_dlt_stats(u64_from_i64(id)?, files)
            .await
    }

    #[node_bindgen]
    async fn get_someip_statistic(
        &self,
        id: i64,
        files: Vec<String>,
    ) -> Result<stypes::CommandOutcome<String>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_someip_statistic(u64_from_i64(id)?, files)
            .await
    }

    #[node_bindgen]
    async fn get_shell_profiles(
        &self,
        id: i64,
    ) -> Result<stypes::CommandOutcome<stypes::ProfileList>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_shell_profiles(u64_from_i64(id)?)
            .await
    }

    #[node_bindgen]
    async fn get_context_envvars(
        &self,
        id: i64,
    ) -> Result<stypes::CommandOutcome<stypes::MapKeyValue>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_context_envvars(u64_from_i64(id)?)
            .await
    }

    #[node_bindgen]
    async fn get_serial_ports_list(
        &self,
        id: i64,
    ) -> Result<stypes::CommandOutcome<stypes::SerialPortsList>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_serial_ports_list(u64_from_i64(id)?)
            .await
    }

    #[node_bindgen]
    async fn get_regex_error(
        &self,
        id: i64,
        filter: WrappedSearchFilter,
    ) -> Result<stypes::CommandOutcome<Option<String>>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_regex_error(u64_from_i64(id)?, filter.as_filter())
            .await
    }

    #[node_bindgen]
    async fn get_all_plugins(
        &self,
        id: i64,
    ) -> Result<stypes::CommandOutcome<stypes::PluginsList>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_all_plugins(u64_from_i64(id)?)
            .await
    }

    #[node_bindgen]
    async fn get_active_plugins(
        &self,
        id: i64,
    ) -> Result<stypes::CommandOutcome<stypes::PluginsList>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_active_plugins(u64_from_i64(id)?)
            .await
    }

    #[node_bindgen]
    async fn reload_plugins(
        &self,
        id: i64,
    ) -> Result<stypes::CommandOutcome<()>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .reload_plugins(u64_from_i64(id)?)
            .await
    }

    #[node_bindgen]
    async fn job_cancel_test(
        &self,
        id: i64,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<stypes::CommandOutcome<i64>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .cancel_test(u64_from_i64(id)?, custom_arg_a, custom_arg_b)
            .await
    }

    #[node_bindgen]
    async fn sleep(
        &self,
        id: i64,
        ms: i64,
    ) -> Result<stypes::CommandOutcome<()>, stypes::ComputationError> {
        self.api
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .sleep(u64_from_i64(id)?, u64_from_i64(ms)?)
            .await
    }
}
