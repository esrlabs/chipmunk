use crate::{events::ComputationError, unbound::job::Job};
use tokio::sync::{mpsc::UnboundedSender, oneshot};
use uuid::Uuid;

#[derive(Debug)]
pub enum API {
    Shutdown(oneshot::Sender<()>),
    CancelJob(Uuid),
    Run(Job, oneshot::Sender<Uuid>),
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

    #[allow(clippy::type_complexity)]
    pub async fn cancel_test<F: Fn(String) + Send + 'static>(
        &self,
        send_operation_uuid: F,
        custom_arg_a: i64,
        custom_arg_b: i64,
    ) -> Result<i64, ComputationError> {
        let (tx_uuid, rx_uuid): (oneshot::Sender<Uuid>, oneshot::Receiver<Uuid>) =
            oneshot::channel();
        let (tx_results, rx_results): (
            oneshot::Sender<Result<i64, ComputationError>>,
            oneshot::Receiver<Result<i64, ComputationError>>,
        ) = oneshot::channel();
        self.tx
            .send(API::Run(
                Job::CancelTest(custom_arg_a, custom_arg_b, tx_results),
                tx_uuid,
            ))
            .map_err(|_| {
                ComputationError::Communication(String::from("Fail to send call Job::SomeJob"))
            })?;
        let uuid = rx_uuid.await.map_err(|_| {
            ComputationError::Communication(String::from("Fail to get uuid of Job::SomeJob"))
        })?;
        send_operation_uuid(uuid.to_string());
        rx_results.await.map_err(|_| {
            ComputationError::Communication(String::from("Fail to get results of Job::SomeJob"))
        })?
    }
}
