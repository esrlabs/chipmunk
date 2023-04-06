use crate::js::{
    converting::filter::WrappedSearchFilter, session::events::ComputationErrorWrapper,
};
use log::{debug, error};
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    derive::node_bindgen,
    sys::napi_value,
};
use serde::Serialize;
use session::{
    events::ComputationError,
    unbound::{api::UnboundSessionAPI, commands::CommandOutcome, UnboundSession},
};
use std::{convert::TryFrom, thread};
use tokio::runtime::Runtime;
use tokio_util::sync::CancellationToken;

struct UnboundJobs {
    api: Option<UnboundSessionAPI>,
    finished: CancellationToken,
}

pub(crate) struct CommandOutcomeWrapper<T: Serialize>(pub CommandOutcome<T>);

impl<T: Serialize> TryIntoJs for CommandOutcomeWrapper<T> {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        match serde_json::to_string(&self.0) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {e}"
            ))),
        }
    }
}

fn id_from_i64(id: i64) -> Result<u64, ComputationErrorWrapper> {
    u64::try_from(id).map_err(|_| {
        ComputationErrorWrapper(ComputationError::InvalidArgs(String::from(
            "ID of job is invalid",
        )))
    })
}

fn usize_from_i64(id: i64) -> Result<usize, ComputationErrorWrapper> {
    usize::try_from(id).map_err(|_| {
        ComputationErrorWrapper(ComputationError::InvalidArgs(String::from(
            "Fail to conver i64 to usize",
        )))
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
    async fn init(&mut self) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {e}"))
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
    async fn destroy(&self) -> Result<(), ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .shutdown()
            .await?;
        self.finished.cancelled().await;
        Ok(())
    }

    /// Cancel given operation/task
    #[node_bindgen]
    async fn abort(&self, id: i64) -> Result<(), ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .cancel_job(&id_from_i64(id)?)
            .await
            .map_err(ComputationErrorWrapper)
    }

    // Custom methods (jobs)
    #[node_bindgen]
    async fn list_folder_content(
        &self,
        id: i64,
        depth: i64,
        path: String,
    ) -> Result<CommandOutcomeWrapper<String>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .list_folder_content(id_from_i64(id)?, usize_from_i64(depth)?, path)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn spawn_process(
        &self,
        id: i64,
        path: String,
        args: Vec<String>,
    ) -> Result<CommandOutcomeWrapper<()>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .spawn_process(id_from_i64(id)?, path, args)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn get_file_checksum(
        &self,
        id: i64,
        path: String,
    ) -> Result<CommandOutcomeWrapper<String>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .get_file_checksum(id_from_i64(id)?, path)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn get_dlt_stats(
        &self,
        id: i64,
        files: Vec<String>,
    ) -> Result<CommandOutcomeWrapper<String>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .get_dlt_stats(id_from_i64(id)?, files)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn get_shell_profiles(
        &self,
        id: i64,
    ) -> Result<CommandOutcomeWrapper<String>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .get_shell_profiles(id_from_i64(id)?)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn get_context_envvars(
        &self,
        id: i64,
    ) -> Result<CommandOutcomeWrapper<String>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .get_context_envvars(id_from_i64(id)?)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn get_serial_ports_list(
        &self,
        id: i64,
    ) -> Result<CommandOutcomeWrapper<Vec<String>>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .get_serial_ports_list(id_from_i64(id)?)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn get_regex_error(
        &self,
        id: i64,
        filter: WrappedSearchFilter,
    ) -> Result<CommandOutcomeWrapper<Option<String>>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .get_regex_error(id_from_i64(id)?, filter.as_filter())
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn job_cancel_test(
        &self,
        id: i64,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<CommandOutcomeWrapper<i64>, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .cancel_test(id_from_i64(id)?, custom_arg_a, custom_arg_b)
            .await
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }
}
