mod api;
mod plugins;

use api::*;
use descriptor::{LazyLoadingResult, LazyLoadingTaskMeta};
use log::{debug, error};
use register::Register;
use std::{collections::HashMap, sync::Arc};
use tokio::{
    sync::{
        RwLock,
        mpsc::{UnboundedReceiver, UnboundedSender, error::SendError, unbounded_channel},
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
pub struct SessionRegister {
    tx_api: UnboundedSender<Api>,
}

impl SessionRegister {
    /// Creates a new components session.
    ///
    /// This method initializes the `SessionRegister` and returns a tuple containing the session instance
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
    pub async fn new()
    -> Result<(Self, UnboundedReceiver<stypes::CallbackOptionsEvent>), stypes::NativeError> {
        // TODO: Plugins manager is used temporally here in initial phase and we should consider
        // moving it to its own module. Reasons:
        // * It doesn't need parallelism for most of task.
        // * It'll need different state and locking management for downloading plugins, Updating
        // caches etc...
        let plugins_manager = plugins::load_manager().await?;

        let (tx_api, mut rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) =
            unbounded_channel();
        let (tx_callback_events, rx_callback_events): (
            UnboundedSender<stypes::CallbackOptionsEvent>,
            UnboundedReceiver<stypes::CallbackOptionsEvent>,
        ) = unbounded_channel();
        let mut register: Register = Register::new();
        // Registre parsers
        parsers_registration(&mut register)?;
        // Registre sources
        plugins_manager.register_plugins(&mut register)?;
        let plugins_manager = Arc::new(RwLock::new(plugins_manager));
        sources_registration(&mut register)?;
        let tx_api_inner = tx_api.clone();
        let session = Self { tx_api };
        task::spawn(async move {
            debug!("Session is started");
            let mut tasks: HashMap<Uuid, (LazyLoadingTaskMeta, JoinHandle<()>)> = HashMap::new();
            while let Some(msg) = rx_api.recv().await {
                match msg {
                    Api::GetOutputRender(uuid, tx) => {
                        log_if_err(tx.send(register.get_output_render(&uuid)));
                    }
                    Api::GetIdent(uuid, tx) => {
                        log_if_err(tx.send(register.get_ident(&uuid)));
                    }
                    Api::GetOptions {
                        origin,
                        targets,
                        tx,
                    } => {
                        let mut options = match register.get_options(origin, targets) {
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
                        log_if_err(tx.send(Ok(register.get_components(ty, origin))));
                    }
                    Api::IsSdeSupported(origin, uuid, tx) => {
                        log_if_err(tx.send(register.is_sde_supported(&uuid, &origin)));
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
                        log_if_err(tx.send(register.validate(&origin, &target, &fields)));
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

                    Api::InstalledPluginsList(tx) => {
                        // let plugs_ref_clone = Arc::clone(&plugins_manager);
                        log_if_err(tx.send(plugins::installed_plugins_list(&plugins_manager).await))
                    }
                    Api::InvalidPluginsList(tx) => {
                        log_if_err(tx.send(plugins::invalid_plugins_list(&plugins_manager).await))
                    }
                    Api::InstalledPluginsPaths(tx) => log_if_err(
                        tx.send(plugins::installed_plugins_paths(&plugins_manager).await),
                    ),
                    Api::InvalidPluginsPaths(tx) => {
                        log_if_err(tx.send(plugins::invalid_plugins_paths(&plugins_manager).await))
                    }
                    Api::InstalledPluginInfo(path, tx) => log_if_err(
                        tx.send(plugins::installed_plugins_info(path, &plugins_manager).await),
                    ),
                    Api::InvalidPluginInfo(path, tx) => log_if_err(
                        tx.send(plugins::invalid_plugins_info(path, &plugins_manager).await),
                    ),
                    Api::PluginRunData(path, tx) => log_if_err(
                        tx.send(plugins::get_plugin_run_data(path, &plugins_manager).await),
                    ),
                    Api::ReloadPlugins(tx) => {
                        log_if_err(tx.send(plugins::reload_plugins(&plugins_manager).await))
                    }
                    Api::AddPlugin(path, typ, tx) => {
                        log_if_err(tx.send(plugins::add_plugin(path, typ, &plugins_manager).await))
                    }
                    Api::RemovePlugin(path, tx) => {
                        log_if_err(tx.send(plugins::remove_plugin(path, &plugins_manager).await))
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
        origin: stypes::SessionAction,
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

    /// Requests the render supported by parser
    ///
    /// This API is used by the client to retrieve the render to use.
    ///
    /// # Arguments
    ///
    /// * `uuid` - Uuid of parser.
    ///
    /// # Result
    ///
    /// * `Result<Option<stypes::OutputRender>, NativeError>` - The result containing the render or an error.
    ///
    /// # Note
    /// If component doesn't have render, returns `None`   
    pub async fn get_output_render(
        &self,
        uuid: Uuid,
    ) -> Result<Option<stypes::OutputRender>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetOutputRender(uuid, tx)),
            "Fail to send Api::GetOutputRender",
        )?;
        response(rx.await, "Fail to get response from Api::GetOutputRender")?
    }

    /// Requests the ident of component
    ///
    /// This API is used by the client to retrieve the identification of component parser or source.
    ///
    /// # Arguments
    ///
    /// * `Uuid` - Uuid of component (parser / source).
    /// * `tx` - A one-shot sender used to deliver the result back to the client.
    ///
    /// # Result
    ///
    /// * `Result<Option<stypes::Ident>, NativeError>` - Ident of target component.
    ///
    /// # Note
    /// If component doesn't exist, returns `None`
    pub async fn get_ident(
        &self,
        uuid: Uuid,
    ) -> Result<Option<stypes::Ident>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetIdent(uuid, tx)),
            "Fail to send Api::GetIdent",
        )?;
        response(rx.await, "Fail to get response from Api::GetIdent")
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
        origin: stypes::SessionAction,
        ty: stypes::ComponentType,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::GetComponents(origin, ty, tx)),
            "Fail to send Api::GetComponents",
        )?;
        response(rx.await, "Fail to get response from Api::GetComponents")?
    }

    /// Asynchronously checks whether the specified source supports the Source Data Exchange (SDE) mechanism.
    ///
    /// This is a high-level wrapper that sends an [`Api::IsSdeSupported`] request to the internal API
    /// and awaits the result. The method is asynchronous and returns either the result of the check
    /// or an error if the request fails or the source is not found.
    ///
    /// # Arguments
    ///
    /// * `uuid` — The unique identifier of the source component to check.
    /// * `origin` — The session context used to evaluate SDE permissions.
    ///
    /// # Returns
    ///
    /// * `Ok(true)` — if the source supports SDE.
    /// * `Ok(false)` — if the source does not support SDE.
    /// * `Err(NativeError)` — if the request could not be sent or the response failed.
    pub async fn is_sde_supported(
        &self,
        uuid: Uuid,
        origin: stypes::SessionAction,
    ) -> Result<bool, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::IsSdeSupported(origin, uuid, tx)),
            "Fail to send Api::IsSdeSupported",
        )?;
        response(rx.await, "Fail to get response from Api::IsSdeSupported")?
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
        source: stypes::SessionAction,
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

    /// Get all information of installed plugins .
    pub async fn installed_plugins_list(&self) -> Result<stypes::PluginsList, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::InstalledPluginsList(tx)),
            "Fail to send Api::InstalledPluginsList",
        )?;
        response(
            rx.await,
            "Fail to get response from Api::InstalledPluginsList",
        )?
    }

    /// Get all information of invalid plugins .
    pub async fn invalid_plugins_list(
        &self,
    ) -> Result<stypes::InvalidPluginsList, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::InvalidPluginsList(tx)),
            "Fail to send Api::InvalidPluginsList",
        )?;
        response(
            rx.await,
            "Fail to get response from Api::InvalidPluginsList",
        )?
    }

    /// Get the directory paths (considered ID) for installed plugins.
    pub async fn installed_plugins_paths(
        &self,
    ) -> Result<stypes::PluginsPathsList, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::InstalledPluginsPaths(tx)),
            "Fail to send Api::InstalledPluginsPaths",
        )?;
        response(
            rx.await,
            "Fail to get response from Api::InstalledPluginsPaths",
        )?
    }

    /// Get the directory paths (considered ID) for invalid plugins.
    pub async fn invalid_plugins_paths(
        &self,
    ) -> Result<stypes::PluginsPathsList, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::InvalidPluginsPaths(tx)),
            "Fail to send Api::InvalidPluginsPaths",
        )?;
        response(
            rx.await,
            "Fail to get response from Api::InvalidPluginsPaths",
        )?
    }

    /// Get all info for the installed plugin with provided directory path (considered ID)
    pub async fn installed_plugin_info(
        &self,
        plugin_path: String,
    ) -> Result<Option<stypes::PluginEntity>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::InstalledPluginInfo(plugin_path, tx)),
            "Fail to send Api::InstalledPluginInfo",
        )?;
        response(
            rx.await,
            "Fail to get response from Api::InstalledPluginInfo",
        )?
    }

    /// Get all info for the invalid plugin with provided directory path (considered ID)
    pub async fn invalid_plugin_info(
        &self,
        plugin_path: String,
    ) -> Result<Option<stypes::InvalidPluginEntity>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::InvalidPluginInfo(plugin_path, tx)),
            "Fail to send Api::InvalidPluginInfo",
        )?;
        response(rx.await, "Fail to get response from Api::InvalidPluginInfo")?
    }

    /// Retrieves runtime data for a plugin located at the specified path.
    pub async fn get_plugin_run_data(
        &self,
        plugin_path: String,
    ) -> Result<Option<stypes::PluginRunData>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::PluginRunData(plugin_path, tx)),
            "Fail to send Api::PluginRunData",
        )?;
        response(rx.await, "Fail to get response from Api::PluginRunData")?
    }

    /// Reload the plugin directory.
    pub async fn reload_plugins(&self) -> Result<(), stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::ReloadPlugins(tx)),
            "Fail to send Api::ReloadPlugins",
        )?;
        response(rx.await, "Fail to get response from Api::ReloadPlugins")?
        //TODO AAZ: Reload components on reload plugins
    }

    /// Adds a plugin with the given directory path and optional plugin type.
    pub async fn add_plugin(
        &self,
        plugin_path: String,
        plugin_type: Option<stypes::PluginType>,
    ) -> Result<(), stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api
                .send(Api::AddPlugin(plugin_path, plugin_type, tx)),
            "Fail to send Api::AddPlugin",
        )?;
        response(rx.await, "Fail to get response from Api::AddPlugin")?
    }

    /// Removes the plugin with the given directory path.
    pub async fn remove_plugin(&self, plugin_path: String) -> Result<(), stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        send(
            self.tx_api.send(Api::RemovePlugin(plugin_path, tx)),
            "Fail to send Api::RemovePlugin",
        )?;
        response(rx.await, "Fail to get response from Api::RemovePlugin")?
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
        error!("[Register] Fail to send response to Api");
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

// use parsers::api::*;
// use sources::api::*;

pub fn parsers_registration(register: &mut Register) -> Result<(), stypes::NativeError> {
    register.add_parser(
        parsers::dlt::descriptor::factory,
        parsers::dlt::descriptor::Descriptor::default(),
    )?;
    register.add_parser(
        parsers::dlt::descriptor::factory,
        parsers::dlt::raw::descriptor::Descriptor::default(),
    )?;
    register.add_parser(
        parsers::someip::descriptor::factory,
        parsers::someip::descriptor::Descriptor::default(),
    )?;
    register.add_parser(
        parsers::text::descriptor::factory,
        parsers::text::descriptor::Descriptor::default(),
    )?;
    Ok(())
}

pub fn sources_registration(register: &mut Register) -> Result<(), stypes::NativeError> {
    register.add_source(
        sources::binary::raw::factory,
        sources::binary::raw::Descriptor::default(),
    )?;
    register.add_source(
        sources::binary::pcap::legacy::factory,
        sources::binary::pcap::legacy::Descriptor::default(),
    )?;
    register.add_source(
        sources::binary::pcap::ng::factory,
        sources::binary::pcap::ng::Descriptor::default(),
    )?;
    register.add_source(
        sources::socket::tcp::factory,
        sources::socket::tcp::Descriptor::default(),
    )?;
    register.add_source(
        sources::socket::udp::factory,
        sources::socket::udp::Descriptor::default(),
    )?;
    register.add_source(
        sources::serial::descriptor::factory,
        sources::serial::descriptor::Descriptor::default(),
    )?;
    register.add_source(
        sources::command::factory,
        sources::command::Descriptor::default(),
    )?;
    Ok(())
}
