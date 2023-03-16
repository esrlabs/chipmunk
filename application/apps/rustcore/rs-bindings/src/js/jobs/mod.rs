use crate::js::session::events::ComputationErrorWrapper;
use log::{debug, error};
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    derive::node_bindgen,
    sys::napi_value,
};
use serde::Serialize;
use session::{
    events::{ComputationError, LifecycleTransition},
    operations,
    unbound::{api::UnboundSessionAPI, commands::CommandOutcome, UnboundSession},
};
use std::thread;
use tokio::{runtime::Runtime, sync::mpsc::UnboundedSender};
use tokio_util::sync::CancellationToken;

use super::session::progress_tracker::TRACKER_CHANNEL;

struct UnboundJobs {
    api: Option<UnboundSessionAPI>,
    finished: CancellationToken,
    tracker_tx: Option<UnboundedSender<LifecycleTransition>>,
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

#[node_bindgen]
impl UnboundJobs {
    // Self methods
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            api: None,
            finished: CancellationToken::new(),
            tracker_tx: None,
        }
    }

    #[node_bindgen(mt)]
    async fn init(&mut self) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;
        let tracker_tx = TRACKER_CHANNEL
            .lock()
            .map(|channels| channels.0.clone())
            .map_err(|e| {
                ComputationErrorWrapper(ComputationError::Process(format!(
                    "Could not start an unbound session, tracker_tx unavailable {e}"
                )))
            })?;
        self.tracker_tx = Some(tracker_tx);

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
    async fn abort(&self, operation_uuid: String) -> Result<(), ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .cancel_job(
                &operations::uuid_from_str(&operation_uuid).map_err(ComputationErrorWrapper)?,
            )
            .await
            .map_err(ComputationErrorWrapper)
    }

    // Custom methods (jobs)
    #[node_bindgen]
    async fn list_folder_content<F: Fn(String) + Send + 'static>(
        &self,
        send_operation_uuid: F,
        path: String,
    ) -> Result<CommandOutcomeWrapper<String>, ComputationErrorWrapper> {
        println!("rs_bindings: list_folder_content");
        let (job_future, job_uuid) = self
            .api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .list_folder_content(path);
        self.register_job_start(job_uuid.to_string());
        send_operation_uuid(job_uuid.to_string());

        let job_result = job_future.await;
        self.register_job_end(job_uuid.to_string());

        job_result
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    #[node_bindgen]
    async fn job_cancel_test<F: Fn(String) + Send + 'static>(
        &self,
        send_operation_uuid: F,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<CommandOutcomeWrapper<i64>, ComputationErrorWrapper> {
        let (job_future, job_uuid) = self
            .api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)?
            .cancel_test(custom_arg_a, custom_arg_b);
        self.register_job_start(job_uuid.to_string());
        send_operation_uuid(job_uuid.to_string());

        let job_result = job_future.await;
        self.register_job_end(job_uuid.to_string());

        job_result
            .map_err(ComputationErrorWrapper)
            .map(CommandOutcomeWrapper)
    }

    fn register_job_start(&self, uuid: String) {
        if let Some(tracker_tx) = self.tracker_tx.as_ref() {
            let _ = tracker_tx.send(LifecycleTransition::Started(uuid));
        }
    }

    fn register_job_end(&self, uuid: String) {
        if let Some(tracker_tx) = self.tracker_tx.as_ref() {
            let _ = tracker_tx.send(LifecycleTransition::Stopped(uuid));
        }
    }
}
