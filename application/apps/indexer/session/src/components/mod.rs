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
                        parser,
                        source,
                        origin,
                        tx,
                    } => {
                        let options = match components.get_options(origin, source, parser) {
                            Ok(options) => options,
                            Err(err) => {
                                log_if_err(tx.send(Err(err)));
                                continue;
                            }
                        };
                        // Send static fields
                        log_if_err(tx.send(Ok(stypes::ComponentsOptions {
                            source: options.source,
                            parser: options.parser,
                        })));
                        if let Some(mut source_loading_task) = options.lazy_source {
                            // If exists, request lazy source fields
                            let meta = source_loading_task.get_meta();
                            let uuid = meta.uuid;
                            let tx_api = tx_api_inner.clone();
                            tasks.insert(
                                uuid,
                                (
                                    meta,
                                    task::spawn(async move {
                                        log_if_err(tx_api.send(Api::LazyTaskComplite(
                                            uuid,
                                            source_loading_task.wait().await,
                                        )));
                                    }),
                                ),
                            );
                        }
                        if let Some(mut parser_loading_task) = options.lazy_parser {
                            // If exists, request lazy parser fields
                            let meta = parser_loading_task.get_meta();
                            let uuid = meta.uuid;
                            let tx_api = tx_api_inner.clone();
                            tasks.insert(
                                uuid,
                                (
                                    meta,
                                    task::spawn(async move {
                                        log_if_err(tx_api.send(Api::LazyTaskComplite(
                                            uuid,
                                            parser_loading_task.wait().await,
                                        )));
                                    }),
                                ),
                            );
                        }
                    }
                    // Delivery lazy fields to client.
                    Api::LazyTaskComplite(uuid, results) => {
                        tasks.remove(&uuid);
                        match results {
                            Ok(LazyLoadingResult::Feilds(fields)) => {
                                log_if_err(
                                    tx_callback_events
                                        .send(stypes::CallbackOptionsEvent::Options(fields)),
                                );
                            }
                            Ok(..) => {
                                // Task has been cancelled
                                continue;
                            }
                            Err(err) => {
                                // TODO: Error should be delivered to client with bound field UUID
                                error!("Fail to load lazy field with: {err:?}");
                            }
                        }
                    }
                    Api::GetParsers(origin, tx) => {
                        log_if_err(tx.send(components.get_parsers(origin)));
                    }
                    Api::GetSources(origin, tx) => {
                        log_if_err(tx.send(components.get_sources(origin)));
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
                    }
                }
            }
            debug!("Session task is finished");
        });
        Ok((session, rx_callback_events))
    }

    pub async fn get_options(
        &self,
        source: Uuid,
        parser: Uuid,
        origin: stypes::SourceOrigin,
    ) -> Result<stypes::ComponentsOptions, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetOptions {
                parser,
                source,
                origin,
                tx,
            }),
            "Fail to send Api::GetOptions",
        )?;
        response(rx.await, "Fail to get response from Api::GetOptions")?
    }

    pub async fn get_sources(
        &self,
        origin: stypes::SourceOrigin,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetSources(origin, tx)),
            "Fail to send Api::GetSources",
        )?;
        response(rx.await, "Fail to get response from Api::GetSources")?
    }

    pub async fn get_parsers(
        &self,
        origin: stypes::SourceOrigin,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetParsers(origin, tx)),
            "Fail to send Api::GetParsers",
        )?;
        response(rx.await, "Fail to get response from Api::GetParsers")?
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
