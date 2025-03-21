mod api;

use api::*;

use components::{Component, Components};
use log::{debug, error, warn};
use parsers::prelude as parsers;
use sources::prelude as sources;
use tokio::{
    sync::{
        mpsc::{error::SendError, unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot::{self, error::RecvError},
    },
    task::{self},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct ComponentsSession {
    tx_api: UnboundedSender<API>,
}

impl ComponentsSession {
    /// Starts a global components session
    pub async fn new(
    ) -> Result<(Self, UnboundedReceiver<stypes::CallbackOptionsEvent>), stypes::NativeError> {
        let (tx_api, mut rx_api): (UnboundedSender<API>, UnboundedReceiver<API>) =
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
        let session = Self { tx_api };
        let handle = task::spawn(async move {
            while let Some(msg) = rx_api.recv().await {
                match msg {
                    API::GetOptions {
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
                    }
                    API::Shutdown(tx) => {
                        // Close pending
                        let _ = tx.send(());
                    }
                }
            }
            debug!("Session is started");
            // session work
            debug!("Session task is finished");
        });
        Ok((session, rx_callback_events))
    }

    pub async fn get_options(
        &self,
        parser: Uuid,
        source: Uuid,
        origin: stypes::SourceOrigin,
    ) -> Result<(Vec<stypes::FieldDesc>, Vec<stypes::FieldDesc>), stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(API::GetOptions {
                parser,
                source,
                origin,
                tx,
            }),
            "Fail to send API::GetOptions",
        )?;
        response(rx.await, "Fail to get response from API::GetOptions")?
    }

    pub async fn shutdown(&self) -> Result<(), stypes::NativeError> {
        let (tx, rx): (oneshot::Sender<()>, oneshot::Receiver<()>) = oneshot::channel();
        send(
            self.tx_api.send(API::Shutdown(tx)),
            "Fail to send API::Shutdown",
        )?;
        response(rx.await, "Fail to get response from API::Shutdown")
    }
}

fn log_if_err<E>(res: Result<(), E>) {
    if res.is_err() {
        error!("[Components] Fail to send responce to API");
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
