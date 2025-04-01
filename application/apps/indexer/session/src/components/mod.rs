mod api;

use std::collections::HashMap;

use api::*;

use components::{Component, Components, LazyLoadingResult, LazyLoadingTaskMeta};
use log::{debug, error};
use parsers::prelude as parsers;
use sources::prelude as sources;
use tokio::{
    sync::{
        mpsc::{error::SendError, unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot::{self, error::RecvError},
    },
    task::{self, JoinHandle},
};
use uuid::Uuid;

pub struct ComponentsSession {
    tx_api: UnboundedSender<Api>,
}

impl ComponentsSession {
    /// Starts a global components session
    pub async fn new(
    ) -> Result<(Self, UnboundedReceiver<stypes::CallbackOptionsEvent>), stypes::NativeError> {
        let (tx_api, mut rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) =
            unbounded_channel();
        let (tx_callback_events, rx_callback_events): (
            UnboundedSender<stypes::CallbackOptionsEvent>,
            UnboundedReceiver<stypes::CallbackOptionsEvent>,
        ) = unbounded_channel();
        let mut components = Components::default();
        {
            parsers::DltParser::register(&mut components)?;
            parsers::SomeipParser::register(&mut components)?;
            parsers::StringTokenizer::register(&mut components)?;
        }
        {
            sources::BinaryByteSource::<std::io::Empty>::register(&mut components)?;
            sources::PcapLegacyByteSource::<std::io::Empty>::register(&mut components)?;
            sources::PcapngByteSource::<std::io::Empty>::register(&mut components)?;
            sources::TcpSource::register(&mut components)?;
            sources::UdpSource::register(&mut components)?;
            sources::SerialSource::register(&mut components)?;
            sources::ProcessSource::register(&mut components)?;
        }
        let tx_api_inner = tx_api.clone();
        let session = Self { tx_api };
        task::spawn(async move {
            debug!("Session is started");
            let mut tasks: HashMap<Uuid, (LazyLoadingTaskMeta, JoinHandle<()>)> = HashMap::new();
            while let Some(msg) = rx_api.recv().await {
                match msg {
                    Api::GetOptions {
                        origin,
                        targets,
                        tx,
                    } => {
                        let mut options = match components.get_options(origin, targets) {
                            Ok(options) => options,
                            Err(err) => {
                                log_if_err(tx.send(Err(err)));
                                continue;
                            }
                        };
                        // Send static fields
                        log_if_err(
                            tx.send(Ok(stypes::ComponentsOptionsList {
                                options: options
                                    .iter_mut()
                                    .map(|opt| opt.statics.drain(..).collect())
                                    .collect(),
                            })),
                        );
                        // Loading lazy if exist
                        for opt in options.into_iter() {
                            if let Some(mut loading_task) = opt.lazy {
                                // If exists, request lazy source fields
                                let meta = loading_task.get_meta();
                                let uuid = meta.uuid;
                                let tx_api = tx_api_inner.clone();
                                tasks.insert(
                                    uuid,
                                    (
                                        meta,
                                        task::spawn(async move {
                                            log_if_err(tx_api.send(Api::LazyTaskComplite(
                                                uuid,
                                                loading_task.get_meta(),
                                                loading_task.wait().await,
                                            )));
                                        }),
                                    ),
                                );
                            }
                        }
                    }
                    // Delivery lazy fields to client.
                    Api::LazyTaskComplite(uuid, meta, results) => {
                        tasks.remove(&uuid);
                        match results {
                            Ok(LazyLoadingResult::Feilds(fields)) => {
                                let (success, fail): (Vec<_>, Vec<_>) =
                                    fields.into_iter().partition(|(_, result)| result.is_ok());
                                let fields: Vec<stypes::StaticFieldDesc> = success
                                    .into_iter()
                                    .filter_map(|(_, field)| field.ok())
                                    .collect();
                                let errors: Vec<stypes::FieldLoadingError> = fail
                                    .into_iter()
                                    .filter_map(|(id, err)| {
                                        if let Err(err) = err {
                                            Some(stypes::FieldLoadingError { id, err })
                                        } else {
                                            None
                                        }
                                    })
                                    .collect();
                                if !fields.is_empty() {
                                    log_if_err(tx_callback_events.send(
                                        stypes::CallbackOptionsEvent::LoadingDone {
                                            owner: meta.owner(),
                                            fields,
                                        },
                                    ));
                                }
                                if !errors.is_empty() {
                                    log_if_err(tx_callback_events.send(
                                        stypes::CallbackOptionsEvent::LoadingErrors {
                                            owner: meta.owner(),
                                            errors,
                                        },
                                    ));
                                }
                            }
                            Ok(..) => {
                                // Task has been cancelled
                                log_if_err(tx_callback_events.send(
                                    stypes::CallbackOptionsEvent::LoadingCancelled {
                                        owner: meta.owner(),
                                        fields: meta.fields,
                                    },
                                ));
                                continue;
                            }
                            Err(err) => {
                                error!("Fail to load lazy field with: {err}");
                                log_if_err(tx_callback_events.send(
                                    stypes::CallbackOptionsEvent::LoadingError {
                                        owner: meta.owner(),
                                        error: err.to_string(),
                                        fields: meta.fields,
                                    },
                                ));
                            }
                        }
                    }
                    Api::GetComponents(origin, ty, tx) => {
                        log_if_err(tx.send(components.get_components(&ty, origin)));
                    }
                    // Client doesn't need any more field data. Loading task should be cancelled
                    Api::CancelLoading(fields) => {
                        for (_, (meta, _)) in tasks.iter() {
                            if meta.contains(&fields) {
                                meta.cancel.cancel();
                            }
                        }
                    }
                    Api::Shutdown(tx) => {
                        // Cancel / kill pending tasks
                        tasks.iter().for_each(|(_, (meta, handle))| {
                            meta.cancel.cancel();
                            // TODO: we should wait for tasks will be cancelled by it self before abort.
                            handle.abort();
                        });
                        tasks.clear();
                        log_if_err(tx.send(()));
                        break;
                    }
                }
            }
            debug!("Session task is finished");
        });
        Ok((session, rx_callback_events))
    }

    pub async fn get_options(
        &self,
        targets: Vec<Uuid>,
        origin: stypes::SourceOrigin,
    ) -> Result<stypes::ComponentsOptionsList, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetOptions {
                targets,
                origin,
                tx,
            }),
            "Fail to send Api::GetOptions",
        )?;
        response(rx.await, "Fail to get response from Api::GetOptions")?
    }

    pub async fn get_components(
        &self,
        origin: stypes::SourceOrigin,
        ty: stypes::ComponentType,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetComponents(origin, ty, tx)),
            "Fail to send Api::GetParsers",
        )?;
        response(rx.await, "Fail to get response from Api::GetComponents")?
    }

    pub fn abort(&self, fields: Vec<String>) -> Result<(), stypes::NativeError> {
        send(
            self.tx_api.send(Api::CancelLoading(fields)),
            "Fail to send Api::CancelLoading",
        )
    }

    pub async fn shutdown(&self) -> Result<(), stypes::NativeError> {
        let (tx, rx): (oneshot::Sender<()>, oneshot::Receiver<()>) = oneshot::channel();
        send(
            self.tx_api.send(Api::Shutdown(tx)),
            "Fail to send Api::Shutdown",
        )?;
        response(rx.await, "Fail to get response from Api::Shutdown")
    }
}

fn log_if_err<E>(res: Result<(), E>) {
    if res.is_err() {
        error!("[Components] Fail to send responce to Api");
    }
}
fn send<T, S: AsRef<str>>(
    res: Result<(), SendError<T>>,
    msg: S,
) -> Result<(), stypes::NativeError> {
    res.map_err(|_| stypes::NativeError {
        severity: stypes::Severity::ERROR,
        kind: stypes::NativeErrorKind::ChannelError,
        message: Some(msg.as_ref().to_string()),
    })
}

fn response<T, S: AsRef<str>>(res: Result<T, RecvError>, msg: S) -> Result<T, stypes::NativeError> {
    res.map_err(|e| stypes::NativeError {
        severity: stypes::Severity::ERROR,
        kind: stypes::NativeErrorKind::ChannelError,
        message: Some(format!("{}: {e:?}", msg.as_ref())),
    })
}
