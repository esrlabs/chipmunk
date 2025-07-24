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

/// A controller responsible for managing all available components in the system (such as parsers, sources, etc.).
///
/// This structure acts as a central registry that stores and manages the state of all components throughout
/// the entire application lifecycle. It is instantiated only once and remains active for the application's duration.
///
/// # Fields
///
/// * `tx_api` - An unbounded sender used for communicating with the API. It allows sending API-related messages
///   or commands to manage components or respond to client requests.
pub struct ComponentsSession {
    tx_api: UnboundedSender<Api>,
}

impl ComponentsSession {
    /// Creates a new components session.
    ///
    /// This method initializes the `ComponentsSession` and returns a tuple containing the session instance
    /// and an unbounded receiver. The receiver acts as a feedback channel, allowing the delivery of
    /// asynchronous operation results to the client.
    ///
    /// # Returns
    ///
    /// * `Ok((Self, UnboundedReceiver<stypes::CallbackOptionsEvent>))` - A tuple containing the newly created
    ///   session and the receiver for asynchronous callbacks.
    /// * `Err(stypes::NativeError)` - An error if the session could not be created.
    ///
    /// # Usage
    ///
    /// This method is asynchronous and should be awaited when called. The returned receiver can be used
    /// to listen for callback events related to the components' operations.
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
                                    .map(|(uuid, opt)| (*uuid, opt.extract_spec()))
                                    .collect(),
                            })),
                        );
                        // Loading lazy if exist
                        for (_, opt) in options.into_iter() {
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
                                            log_if_err(tx_api.send(Api::LazyTaskComplete(
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
                    Api::LazyTaskComplete(uuid, meta, results) => {
                        tasks.remove(&uuid);
                        match results {
                            Ok(LazyLoadingResult::Fields(fields)) => {
                                let (success, fail): (Vec<_>, Vec<_>) =
                                    fields.into_iter().partition(|result| result.is_ok());
                                let fields: Vec<stypes::StaticFieldDesc> = success
                                    .into_iter()
                                    .filter_map(|result| result.ok())
                                    .collect();
                                let errors: Vec<stypes::FieldLoadingError> =
                                    fail.into_iter().filter_map(|result| result.err()).collect();
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
                    Api::Validate(origin, target, fields, tx) => {
                        log_if_err(tx.send(components.validate(&origin, &target, &fields)));
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

    /// Retrieves the configuration options for a list of components.
    ///
    /// This method sends an asynchronous request to obtain the settings of the specified components.
    /// It uses the `Api::GetOptions` command to communicate with the underlying system.
    ///
    /// # Arguments
    ///
    /// * `targets` - A vector of UUIDs representing the components whose settings are being requested.
    /// * `origin` - The source origin within which the components are being used.
    ///
    /// # Returns
    ///
    /// * `Ok(stypes::ComponentsOptionsList)` - The list of component configuration options.
    /// * `Err(stypes::NativeError)` - An error if the request fails or the response is not received.
    ///
    /// # Errors
    ///
    /// The method returns an error if:
    /// - The API request could not be sent.
    /// - The response from the API could not be retrieved.
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

    /// Retrieves the list of available components of a specified type.
    ///
    /// This method sends an asynchronous request to get the list of components, filtered by type.
    /// It uses the `Api::GetComponents` command to query the system.
    ///
    /// # Arguments
    ///
    /// * `origin` - The source origin within which the components are being used.
    /// * `ty` - The type of components to retrieve (e.g., parser, source).
    ///
    /// # Returns
    ///
    /// * `Ok(Vec<stypes::Ident>)` - A vector of component identifiers.
    /// * `Err(stypes::NativeError)` - An error if the request fails or the response is not received.
    ///
    /// # Errors
    ///
    /// The method returns an error if:
    /// - The API request could not be sent.
    /// - The response from the API could not be retrieved.
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

    /// Aborts the lazy loading tasks for the specified fields.
    ///
    /// This method sends a cancellation request for ongoing lazy loading tasks associated with the given field IDs.
    /// It uses the `Api::CancelLoading` command to perform the operation.
    ///
    /// # Arguments
    ///
    /// * `fields` - A vector of field IDs for which the lazy loading should be aborted.
    ///
    /// # Returns
    ///
    /// * `Ok(())` - If the cancellation request was successfully sent.
    /// * `Err(stypes::NativeError)` - An error if the API request could not be sent.
    pub fn abort(&self, fields: Vec<String>) -> Result<(), stypes::NativeError> {
        send(
            self.tx_api.send(Api::CancelLoading(fields)),
            "Fail to send Api::CancelLoading",
        )
    }

    /// Asynchronously validates the configuration of a specific component.
    ///
    /// This method sends a validation request to the system and waits for the response asynchronously.
    ///
    /// # Arguments
    ///
    /// * `source` - The origin type indicating the context in which the validation is performed.
    /// * `target` - The identifier of the component (parser, source).
    /// * `fields` - A list of configuration field values to be validated.
    ///
    /// # Returns
    ///
    /// `Result<HashMap<String, String>, stypes::NativeError>`:
    /// * On success: A `HashMap` where the key is the field's identifier (`String`) and the value is the error message (`String`).
    /// * If all fields are valid and have no errors, an empty `HashMap` is returned.
    /// * On failure: A `stypes::NativeError` indicating the reason for the validation failure.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// * The API call to validate the configuration fails to send.
    /// * The response from the validation API cannot be retrieved.
    pub async fn validate(
        &self,
        source: stypes::SourceOrigin,
        target: Uuid,
        fields: Vec<stypes::Field>,
    ) -> Result<HashMap<String, String>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::Validate(source, target, fields, tx)),
            "Fail to send Api::Validate",
        )?;
        response(rx.await, "Fail to get response from Api::Validate")?
    }

    /// Initiates the shutdown process for the components session.
    ///
    /// This method sends a shutdown command to gracefully terminate the session.
    /// It uses the `Api::Shutdown` command to initiate the shutdown.
    ///
    /// # Returns
    ///
    /// * `Ok(())` - If the shutdown request was successfully sent and acknowledged.
    /// * `Err(stypes::NativeError)` - An error if the shutdown process fails.
    ///
    /// # Errors
    ///
    /// The method returns an error if:
    /// - The API request could not be sent.
    /// - The response from the API could not be retrieved.
    pub async fn shutdown(&self) -> Result<(), stypes::NativeError> {
        let (tx, rx): (oneshot::Sender<()>, oneshot::Receiver<()>) = oneshot::channel();
        send(
            self.tx_api.send(Api::Shutdown(tx)),
            "Fail to send Api::Shutdown",
        )?;
        response(rx.await, "Fail to get response from Api::Shutdown")
    }
}

/// Logs an error if the given result contains an error.
///
/// This function is a simple utility to reduce boilerplate when handling errors
/// that should be logged but do not require further processing. If the result is
/// an error, a log message will be recorded.
///
/// # Arguments
///
/// * `res` - A `Result` that may contain an error. If `Err`, it will be logged.
fn log_if_err<E>(res: Result<(), E>) {
    if res.is_err() {
        error!("[Components] Fail to send response to Api");
    }
}

/// Wraps the result of sending a message and converts a sending error into a native error.
///
/// This function simplifies error handling when sending messages between asynchronous tasks.
/// It converts a `SendError` into a standardized `NativeError` format.
///
/// # Arguments
///
/// * `res` - A result from attempting to send a message via a channel.
/// * `msg` - A string slice providing context for the error message.
///
/// # Returns
///
/// * `Ok(())` - If the message was sent successfully.
/// * `Err(stypes::NativeError)` - If there was a failure during message sending.
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

/// Wraps the result of receiving a message and converts a receiving error into a native error.
///
/// This function simplifies error handling when awaiting a response from an asynchronous channel.
/// It converts a `RecvError` into a standardized `NativeError` format with a detailed message.
///
/// # Arguments
///
/// * `res` - A result from awaiting a response from a channel.
/// * `msg` - A string slice providing context for the error message.
///
/// # Returns
///
/// * `Ok(T)` - The successfully received value.
/// * `Err(stypes::NativeError)` - If there was a failure during message reception.
fn response<T, S: AsRef<str>>(res: Result<T, RecvError>, msg: S) -> Result<T, stypes::NativeError> {
    res.map_err(|e| stypes::NativeError {
        severity: stypes::Severity::ERROR,
        kind: stypes::NativeErrorKind::ChannelError,
        message: Some(format!("{}: {e:?}", msg.as_ref())),
    })
}
