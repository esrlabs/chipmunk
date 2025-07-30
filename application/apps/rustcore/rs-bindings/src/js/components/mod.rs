use log::{debug, error};
use node_bindgen::{core::buffer::JSArrayBuffer, derive::node_bindgen};
use session::register::SessionRegister;
use std::{str::FromStr, thread};
use tokio::{runtime::Runtime, sync::oneshot};
use uuid::Uuid;

struct Components {
    session: Option<SessionRegister>,
}

#[node_bindgen]
impl Components {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self { session: None }
    }

    /// Initializes a new session bound to the `Components` instance at the core level.
    /// On the client side, there should only be a single global session; multiple instances of
    /// `Components` are not required-only one is necessary.
    ///
    /// The `Components` structure maintains the list of all available components in the system,
    /// specifically parsers and data sources. It is responsible for:
    /// - Providing the list of available components
    /// - Providing the configuration schema for a component
    /// - Validating component configuration
    /// - Supporting lazy loading of "heavy" configuration fields
    ///
    /// Note: Some components may have configuration fields that cannot be resolved or rendered
    /// immediately (e.g., DLT file statistics). Such configuration fields are referred to as **lazy**.
    /// `Components` first returns a general description of the lazy field, and once the field
    /// is fully resolved, it provides the full configuration metadata.
    /// While waiting, the client displays all static options along with a spinner or loading indicator
    /// for the lazy ones.
    ///
    /// The `abort` method can be used to cancel the loading of a lazy configuration field. This is
    /// particularly important if the user cancels the session before it is fully initialized.
    ///
    /// # Arguments
    /// * `callback: F` - A callback function for communicating with the TypeScript client. It allows
    ///   Rust code to emit events back to the frontend.
    #[node_bindgen(mt)]
    async fn init<F: Fn(stypes::CallbackOptionsEvent) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), stypes::ComputationError> {
        let rt = Runtime::new().map_err(|e| {
            stypes::ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;
        let (tx_session, rx_session) = oneshot::channel();
        thread::spawn(move || {
            rt.block_on(async {
                match SessionRegister::new().await {
                    Ok((session, mut rx_callback_events)) => {
                        if tx_session.send(Some(session)).is_err() {
                            error!("Cannot setup session instance");
                            return;
                        }
                        debug!("task is started");
                        while let Some(event) = rx_callback_events.recv().await {
                            callback(event)
                        }
                        debug!("sending Destroyed event");
                        callback(stypes::CallbackOptionsEvent::Destroyed);
                        debug!("task is finished");
                    }
                    Err(e) => {
                        error!("Cannot create session instance: {e:?}");
                        if tx_session.send(None).is_err() {
                            error!("Cannot setup session instance");
                        }
                    }
                }
            })
        });
        self.session = rx_session.await.map_err(|_| {
            stypes::ComputationError::Communication(String::from(
                "Fail to get session instance to setup",
            ))
        })?;
        Ok(())
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
    /// * `Ok(stypes::IdentList)` - A vector of component identifiers.
    /// * `Err(stypes::ComputationError)` - An error if the request fails or the response is not received.
    ///
    /// # Errors
    ///
    /// The method returns an error if:
    /// - The API request could not be sent.
    /// - The response from the API could not be retrieved.
    #[node_bindgen]
    async fn get_components(
        &self,
        origin: JSArrayBuffer,
        ty: JSArrayBuffer,
    ) -> Result<stypes::IdentList, stypes::ComputationError> {
        let ty = stypes::ComponentType::decode(&ty).map_err(stypes::ComputationError::Decoding)?;
        let origin =
            stypes::SessionAction::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_components(origin, ty)
            .await
            .map(|idents| idents.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Checks whether a source supports the Source Data Exchange (SDE) mechanism.
    ///
    /// This is an asynchronous Node.js-exposed method that receives a source UUID and a serialized
    /// [`SessionAction`] buffer. It decodes the session context, parses the UUID, and delegates
    /// the actual check to the internal session logic. This method allows JavaScript code
    /// to determine if sending data to a specific source is permitted.
    ///
    /// # Arguments
    ///
    /// * `uuid` - A string representation of the source UUID.
    /// * `origin` - A JavaScript `ArrayBuffer` containing a serialized [`SessionAction`] object.
    ///
    /// # Returns
    ///
    /// A `Promise` resolving to `true` if SDE is supported, `false` otherwise.
    ///
    /// # Errors
    ///
    /// Returns a [`ComputationError`] in the following cases:
    /// - If the session is not available,
    /// - If decoding the `origin` buffer fails,
    /// - If the UUID is invalid,
    /// - If the underlying native API returns an error.
    #[node_bindgen]
    async fn is_sde_supported(
        &self,
        uuid: String,
        origin: JSArrayBuffer,
    ) -> Result<bool, stypes::ComputationError> {
        let origin =
            stypes::SessionAction::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let uuid = Uuid::from_str(&uuid).map_err(|_| stypes::ComputationError::InvalidData)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .is_sde_supported(uuid, origin)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Returns a list of compatible source and parser components that can be used without configuration.
    ///
    /// This method is exposed to JavaScript and is typically used in "quick start" workflows,
    /// such as opening a file without specifying any component settings. It decodes the session context
    /// from the provided binary buffer and delegates the lookup to the internal API.
    ///
    /// The result includes only those components that:
    /// - Are compatible with the provided session (`SessionAction`);
    /// - Support default options (i.e., do not require explicit configuration);
    /// - Match the inferred IO type (e.g., text vs binary).
    ///
    /// # Arguments
    ///
    /// * `origin` – A serialized [`SessionAction`] (as `ArrayBuffer` from JavaScript),
    ///              describing the context of the session (e.g., file path, multiple files).
    ///
    /// # Returns
    ///
    /// A `Promise` resolving to a [`ComponentsList`] object containing matching sources and parsers.
    /// If no compatible components are found, the list will be empty.
    ///
    /// # Errors
    ///
    /// Returns a [`ComputationError`] in the following cases:
    /// - Invalid or undecodable session data (`Decoding`);
    /// - Session not initialized (`SessionUnavailable`);
    /// - Internal failure in component resolution (`NativeError`).
    #[node_bindgen]
    async fn get_compatible_setup(
        &self,
        origin: JSArrayBuffer,
    ) -> Result<stypes::ComponentsList, stypes::ComputationError> {
        let origin =
            stypes::SessionAction::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_compatible_setup(origin)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Retrieves the default configuration options for a specific component,
    /// if it can be used without explicit user configuration.
    ///
    /// This method is exposed to JavaScript and is typically used when attempting to automatically
    /// initialize a source or parser. It decodes the session context and validates the component UUID,
    /// then queries whether the component provides default options for that context.
    ///
    /// If the component requires manual configuration, the method returns an error.
    ///
    /// # Arguments
    ///
    /// * `origin` – A serialized [`SessionAction`] passed from JavaScript as `ArrayBuffer`.
    ///              This provides context such as the file being opened or the session type.
    /// * `uuid` – The string representation of the component’s UUID.
    ///
    /// # Returns
    ///
    /// A `Promise` resolving to a [`FieldList`] object representing the component’s default settings.
    /// If the component has no configurable fields, the list will be empty (`FieldList([])`).
    ///
    /// # Errors
    ///
    /// Returns a [`ComputationError`] in the following cases:
    /// - Invalid or undecodable session data (`Decoding`);
    /// - Malformed or invalid UUID (`InvalidData`);
    /// - Session is not initialized (`SessionUnavailable`);
    /// - The component does not support default options (`NativeError`).
    #[node_bindgen]
    async fn get_default_options(
        &self,
        origin: JSArrayBuffer,
        uuid: String,
    ) -> Result<stypes::FieldList, stypes::ComputationError> {
        let origin =
            stypes::SessionAction::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let uuid = Uuid::from_str(&uuid).map_err(|_| stypes::ComputationError::InvalidData)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_default_options(origin, uuid)
            .await
            .map_err(stypes::ComputationError::NativeError)
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
    /// * `Err(stypes::ComputationError)` - An error if the request fails or the response is not received.
    ///
    /// # Errors
    ///
    /// The method returns an error if:
    /// - The API request could not be sent.
    /// - The response from the API could not be retrieved.
    #[node_bindgen]
    async fn get_options(
        &self,
        origin: JSArrayBuffer,
        targets: Vec<String>,
    ) -> Result<stypes::ComponentsOptionsList, stypes::ComputationError> {
        let targets: Vec<Uuid> = targets
            .into_iter()
            .map(|uuid| Uuid::from_str(&uuid).map_err(|_| stypes::ComputationError::InvalidData))
            .collect::<Result<_, _>>()?;
        let origin =
            stypes::SessionAction::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_options(targets, origin)
            .await
            .map_err(stypes::ComputationError::NativeError)
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
    /// * `Result<Option<stypes::OutputRender>, ComputationError>` - The result containing the render or an error.
    ///
    /// # Note
    /// If component doesn't have render, returns `None`   
    #[node_bindgen]
    async fn get_output_render(
        &self,
        uuid: String,
    ) -> Result<Option<stypes::OutputRender>, stypes::ComputationError> {
        let uuid = Uuid::from_str(&uuid).map_err(|_| stypes::ComputationError::InvalidData)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_output_render(uuid)
            .await
            .map_err(stypes::ComputationError::NativeError)
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
    /// * `Result<Option<stypes::Ident>, ComputationError>` - Ident of target component.
    ///
    /// # Note
    /// If component doesn't exist, returns `None`
    #[node_bindgen]
    async fn get_ident(
        &self,
        uuid: String,
    ) -> Result<Option<stypes::Ident>, stypes::ComputationError> {
        let uuid = Uuid::from_str(&uuid).map_err(|_| stypes::ComputationError::InvalidData)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_ident(uuid)
            .await
            .map_err(stypes::ComputationError::NativeError)
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
    /// `Result<stypes::FieldsValidationErrors, stypes::ComputationError>`:
    /// * On success: A `HashMap` (wrapped into `stypes::FieldsValidationErrors`) where the key is the field's
    ///   identifier (`String`) and the value is the error message (`String`).
    /// * If all fields are valid and have no errors, an empty `HashMap` is returned.
    /// * On failure: A `stypes::ComputationError` indicating the reason for the validation failure.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// * The API call to validate the configuration fails to send.
    /// * The response from the validation API cannot be retrieved.
    #[node_bindgen]
    async fn validate(
        &self,
        origin: JSArrayBuffer,
        options: JSArrayBuffer,
    ) -> Result<stypes::FieldsValidationErrors, stypes::ComputationError> {
        let origin =
            stypes::SessionAction::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let options = stypes::ComponentOptions::decode(&options)
            .map_err(stypes::ComputationError::Decoding)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        Ok(stypes::FieldsValidationErrors {
            errors: session
                .validate(origin, options.uuid, options.fields)
                .await
                .map_err(stypes::ComputationError::NativeError)?,
        })
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
    /// * `Err(stypes::ComputationError)` - An error if the API request could not be sent.
    #[node_bindgen]
    fn abort(&self, fields: Vec<String>) -> Result<(), stypes::ComputationError> {
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .abort(fields)
            .map_err(stypes::ComputationError::NativeError)?;
        Ok(())
    }

    /// Initiates the shutdown process for the components session.
    ///
    /// This method sends a shutdown command to gracefully terminate the session.
    /// It uses the `Api::Shutdown` command to initiate the shutdown.
    ///
    /// # Returns
    ///
    /// * `Ok(())` - If the shutdown request was successfully sent and acknowledged.
    /// * `Err(stypes::ComputationError)` - An error if the shutdown process fails.
    ///
    /// # Errors
    ///
    /// The method returns an error if:
    /// - The API request could not be sent.
    /// - The response from the API could not be retrieved.
    #[node_bindgen]
    async fn destroy(&self) -> Result<(), stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .shutdown()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn installed_plugins_list(
        &self,
    ) -> Result<stypes::PluginsList, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .installed_plugins_list()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn invalid_plugins_list(
        &self,
    ) -> Result<stypes::InvalidPluginsList, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .invalid_plugins_list()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn installed_plugins_paths(
        &self,
    ) -> Result<stypes::PluginsPathsList, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .installed_plugins_paths()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn invalid_plugins_paths(
        &self,
    ) -> Result<stypes::PluginsPathsList, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .invalid_plugins_paths()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn installed_plugin_info(
        &self,
        plugin_path: String,
    ) -> Result<Option<stypes::PluginEntity>, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .installed_plugin_info(plugin_path)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn invalid_plugin_info(
        &self,
        plugin_path: String,
    ) -> Result<Option<stypes::InvalidPluginEntity>, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .invalid_plugin_info(plugin_path)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn get_plugin_run_data(
        &self,
        plugin_path: String,
    ) -> Result<Option<stypes::PluginRunData>, stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .get_plugin_run_data(plugin_path)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn reload_plugins(&self) -> Result<(), stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .reload_plugins()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn add_plugin(&self, plugin_path: String) -> Result<(), stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .add_plugin(plugin_path, None)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn remove_plugin(&self, plugin_path: String) -> Result<(), stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .remove_plugin(plugin_path)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }
}
