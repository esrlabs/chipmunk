use crate::js::session::events::ComputationErrorWrapper;
use log::{debug, error};
use node_bindgen::derive::node_bindgen;
use session::{
    events::ComputationError,
    operations,
    unbound::{api::SessionAPI, session::Session},
};
use std::thread;
use tokio::runtime::Runtime;
use tokio_util::sync::CancellationToken;

struct Jobs {
    api: Option<SessionAPI>,
    finished: CancellationToken,
}

#[node_bindgen]
impl Jobs {
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
        let (mut session, api) = Session::new();
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

    /// Kills unbound session as itself with jump to line 42.
    #[node_bindgen]
    async fn destroy(&self) -> Result<(), ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)
            .map_err(ComputationErrorWrapper)?
            .shutdown()
            .await
            .map_err(ComputationErrorWrapper)?;
        self.finished.cancelled().await;
        Ok(())
    }

    /// Cancel given operation/task
    #[node_bindgen]
    async fn abort(&self, operation_uuid: String) -> Result<(), ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)
            .map_err(ComputationErrorWrapper)?
            .cancel_job(
                &operations::uuid_from_str(&operation_uuid).map_err(ComputationErrorWrapper)?,
            )
            .await
            .map_err(ComputationErrorWrapper)
    }

    // Custom methods (jobs)
    #[node_bindgen]
    async fn job_cancel_test<F: Fn(String) + Send + 'static>(
        &self,
        send_operation_uuid: F,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<i64, ComputationErrorWrapper> {
        self.api
            .as_ref()
            .ok_or(ComputationError::SessionUnavailable)
            .map_err(ComputationErrorWrapper)?
            .cancel_test(send_operation_uuid, custom_arg_a, custom_arg_b)
            .await
            .map_err(ComputationErrorWrapper)
    }
}
