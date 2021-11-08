use crate::js::session::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;
use std::collections::HashMap;
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum Api {
    Add((Uuid, CancellationToken, oneshot::Sender<bool>)),
    Remove((Uuid, oneshot::Sender<bool>)),
    Cancel((Uuid, oneshot::Sender<bool>)),
}

#[derive(Clone)]
pub struct CancelersAPI {
    tx_api: UnboundedSender<Api>,
}

impl CancelersAPI {
    pub fn new() -> (Self, UnboundedReceiver<Api>) {
        let (tx_api, rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) = unbounded_channel();
        (CancelersAPI { tx_api }, rx_api)
    }

    pub async fn add(&self, uuid: Uuid, canceler: CancellationToken) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::Add((uuid, canceler, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::Add; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::Add")),
        })
    }

    pub async fn remove(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::Remove((uuid, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::Remove; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::Remove")),
        })
    }

    pub async fn cancel(
        &self,
        uuid: Uuid,
        canceler: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::Cancel((uuid, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::Cancel; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::Cancel")),
        })
    }
}

pub async fn task(mut rx_api: UnboundedReceiver<Api>) -> Result<(), NativeError> {
    let mut operations: HashMap<Uuid, CancellationToken> = HashMap::new();
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::Add((uuid, token, rx_response)) => {
                if rx_response
                    .send(if !operations.contains_key(&uuid) {
                        operations.insert(uuid, token);
                        true
                    } else {
                        false
                    })
                    .is_err()
                {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::Add")),
                    });
                }
            }
            Api::Remove((uuid, rx_response)) => {
                if rx_response
                    .send(operations.remove(&uuid).is_some())
                    .is_err()
                {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::Remove")),
                    });
                }
            }
            Api::Cancel((uuid, rx_response)) => {
                if rx_response
                    .send(if let Some(token) = operations.remove(&uuid) {
                        token.cancel();
                        true
                    } else {
                        false
                    })
                    .is_err()
                {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::Cancel")),
                    });
                }
            }
        }
    }
    Ok(())
}
