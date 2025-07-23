use std::{collections::HashMap, fmt};

use descriptor::{LazyLoadingResult, LazyLoadingTaskMeta};
use stypes::{Ident, NativeError, SessionAction, SessionDescriptor};
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

/// Represents the various API commands for managing component sessions and operations.
///
/// The `Api` enum defines different commands used within the system, including both public and internal APIs.
/// These commands handle session management, lazy loading operations, and communication between components and clients.
#[derive(Debug)]
pub enum Api {
    /// Initiates the shutdown procedure for the component session controller.
    ///
    /// This API is public and can be accessed by the client.
    /// Upon successful shutdown, it sends a confirmation signal through the provided `oneshot::Sender<()>`.
    Shutdown(oneshot::Sender<()>),

    /// Triggered when the lazy loading of a component's configuration schema has completed.
    ///
    /// This API is internal and not accessible to clients.
    ///
    /// # Arguments
    ///
    /// * `Uuid` - A unique identifier of the component.
    /// * `LazyLoadingTaskMeta` - Metadata associated with the lazy loading task.
    /// * `Result<LazyLoadingResult, NativeError>` - The result of the lazy loading operation, indicating success or failure.
    LazyTaskComplete(
        Uuid,
        LazyLoadingTaskMeta,
        Result<LazyLoadingResult, NativeError>,
    ),

    /// Cancels the ongoing lazy loading of configuration schemas for one or more components.
    ///
    /// This API is triggered by the client when a previously requested lazy loading operation needs to be stopped.
    /// The client does not have knowledge of the internal task identifiers, so it provides a vector of field IDs.
    /// The controller is responsible for identifying the corresponding loading tasks and canceling them.
    ///
    /// # Important
    ///
    /// The client does not receive any confirmation of the cancellation result.
    ///
    /// # Arguments
    ///
    /// * `Vec<String>` - A vector of field IDs for which the loading tasks should be canceled.
    CancelLoading(Vec<String>),

    /// Requests the configuration schema for the specified components.
    ///
    /// This API is used by the client to retrieve the settings of one or more components.
    ///
    /// # Arguments
    ///
    /// * `origin` - The source type within which the client intends to use the components.
    /// * `targets` - A vector of component UUIDs whose configuration schemas are being requested.
    /// * `tx` - A one-shot sender used to deliver the result back to the client.
    ///
    /// # Result
    ///
    /// * `Result<stypes::ComponentsOptionsList, NativeError>` - The result containing the list of component options or an error.
    GetOptions {
        origin: SessionAction,
        targets: Vec<Uuid>,
        tx: oneshot::Sender<Result<stypes::ComponentsOptionsList, NativeError>>,
    },

    /// Requests the render supported by parser
    ///
    /// This API is used by the client to retrieve the render to use.
    ///
    /// # Arguments
    ///
    /// * `Uuid` - Uuid of parser.
    /// * `tx` - A one-shot sender used to deliver the result back to the client.
    ///
    /// # Result
    ///
    /// * `Result<Option<stypes::OutputRender>, NativeError>` - The result containing the render or an error.
    ///
    /// # Note
    /// If component doesn't have render, returns `None`
    GetOutputRender(
        Uuid,
        oneshot::Sender<Result<Option<stypes::OutputRender>, NativeError>>,
    ),

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
    /// * `Option<stypes::Ident>` - Ident of target component.
    ///
    /// # Note
    /// If component doesn't exist, returns `None`
    GetIdent(Uuid, oneshot::Sender<Option<stypes::Ident>>),

    /// Retrieves a list of components available in the system.
    ///
    /// This API is invoked by the client when it needs to get the list of available components of a specific type.
    ///
    /// # Arguments
    ///
    /// * `SessionAction` - The origin type indicating the context in which the components will be used.
    /// * `stypes::ComponentType` - The type of components to retrieve (e.g., parser, source).
    /// * `oneshot::Sender<Result<Vec<Ident>, NativeError>>` - A sender channel for delivering the result back to the client.
    GetComponents(
        SessionAction,
        stypes::ComponentType,
        oneshot::Sender<Result<Vec<Ident>, NativeError>>,
    ),
    /// Validates the configuration for correctness.
    ///
    /// # Arguments
    ///
    /// * `SessionAction` - The origin type indicating the context in which the validation is performed.
    /// * `Uuid` - The identifier of the component (parser, source).
    /// * `Vec<stypes::Field>` - A list of configuration field values.
    /// * `oneshot::Sender<Result<HashMap<String, String>, NativeError>>` - A sender channel for delivering validation results to the client.
    ///
    /// # Returns
    ///
    /// `HashMap<String, String>`:
    /// * Key (`String`) - The field's identifier.
    /// * Value (`String`) - The error message related to the field.
    ///
    /// If all fields are valid and have no errors, an empty `HashMap` will be returned.
    Validate(
        SessionAction,
        Uuid,
        Vec<stypes::Field>,
        oneshot::Sender<Result<HashMap<String, String>, NativeError>>,
    ),

    /// Get all information of the installed plugins .
    InstalledPluginsList(oneshot::Sender<Result<stypes::PluginsList, NativeError>>),
    /// Get all information of invalid plugins .
    InvalidPluginsList(oneshot::Sender<Result<stypes::InvalidPluginsList, NativeError>>),
    /// Get the directory paths (considered ID) for installed plugins.
    InstalledPluginsPaths(oneshot::Sender<Result<stypes::PluginsPathsList, NativeError>>),
    /// Get the directory paths (considered ID) for invalid plugins.
    InvalidPluginsPaths(oneshot::Sender<Result<stypes::PluginsPathsList, NativeError>>),
    /// Get all info for the installed plugin with provided directory path (considered ID)
    InstalledPluginInfo(
        String,
        oneshot::Sender<Result<Option<stypes::PluginEntity>, NativeError>>,
    ),
    /// Get all info for the invalid plugin with provided directory path (considered ID)
    InvalidPluginInfo(
        String,
        oneshot::Sender<Result<Option<stypes::InvalidPluginEntity>, NativeError>>,
    ),
    /// Retrieves runtime data for a plugin located at the specified path.
    PluginRunData(
        String,
        oneshot::Sender<Result<Option<stypes::PluginRunData>, NativeError>>,
    ),
    /// Reload all the plugins from their directory.
    ReloadPlugins(oneshot::Sender<Result<(), NativeError>>),
    /// Adds a plugin with the given directory path and optional plugin type.
    AddPlugin(
        String,
        Option<stypes::PluginType>,
        oneshot::Sender<Result<(), NativeError>>,
    ),
    /// Removes the plugin with the given directory path.
    RemovePlugin(String, oneshot::Sender<Result<(), NativeError>>),
}

use descriptor::*;
use parsers::{Parsers, api::*};
use sources::{Sources, api::*};

/// Registry of all available parsers and sources in the system.
///
/// This struct acts as a central repository that holds references to all registered
/// parser and source components, along with their factory functions and descriptors.
///
/// During session setup, the appropriate factory functions and metadata can be
/// retrieved using UUIDs to create concrete parser and source instances, validate
/// configuration fields, and present component metadata to the user interface.
pub struct Register {
    /// A map of source component UUIDs to their factory functions and descriptors.
    ///
    /// Each entry contains:
    /// - a [`SourceFactory`] used to instantiate the component,
    /// - a boxed [`SourceDescriptor`] that describes its capabilities and configuration.
    sources: HashMap<Uuid, (SourceFactory, Box<dyn SourceDescriptor>)>,

    /// A map of parser component UUIDs to their factory functions and descriptors.
    ///
    /// Each entry contains:
    /// - a [`ParserFactory`] used to instantiate the component,
    /// - a boxed [`ParserDescriptor`] that describes its capabilities and configuration.
    parsers: HashMap<Uuid, (ParserFactory, Box<dyn ParserDescriptor>)>,
}

impl Register {
    /// Creates an empty `Register` with no registered parsers or sources.
    ///
    /// This is typically used at system startup before components are added via
    /// [`add_parser`] or [`add_source`].
    pub fn new() -> Register {
        Self {
            sources: HashMap::new(),
            parsers: HashMap::new(),
        }
    }

    /// Registers a new parser component in the system.
    ///
    /// Associates a parser factory and descriptor with the parser's UUID.
    /// If a parser with the same UUID is already registered, this will return an error.
    ///
    /// # Arguments
    /// * `factory` – A function capable of instantiating the parser.
    /// * `descriptor` – Metadata describing the parser's behavior and configuration.
    ///
    /// # Returns
    /// * `Ok(())` – If the parser was successfully registered.
    /// * `Err(NativeError)` – If a parser with the same UUID already exists.
    pub fn add_parser<D: ParserDescriptor + 'static>(
        &mut self,
        factory: ParserFactory,
        descriptor: D,
    ) -> Result<(), stypes::NativeError> {
        let ident = descriptor.ident();
        if self.parsers.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.parsers
            .insert(ident.uuid, (factory, Box::new(descriptor)));
        Ok(())
    }

    /// Registers a new source component in the system.
    ///
    /// Associates a source factory and descriptor with the source's UUID.
    /// If a source with the same UUID is already registered, this will return an error.
    ///
    /// # Arguments
    /// * `factory` – A function capable of instantiating the source.
    /// * `descriptor` – Metadata describing the source's behavior and configuration.
    ///
    /// # Returns
    /// * `Ok(())` – If the source was successfully registered.
    /// * `Err(NativeError)` – If a source with the same UUID already exists.
    pub fn add_source<D: SourceDescriptor + 'static>(
        &mut self,
        factory: SourceFactory,
        descriptor: D,
    ) -> Result<(), stypes::NativeError> {
        let ident: stypes::Ident = descriptor.ident();
        if self.sources.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.sources
            .insert(ident.uuid, (factory, Box::new(descriptor)));
        Ok(())
    }

    /// Returns a list of parser identifiers compatible with the given session context.
    ///
    /// Filters registered parsers using their `is_compatible` logic and returns
    /// only those that can be used for the given session action.
    ///
    /// # Arguments
    /// * `origin` – The session action context to filter compatible parsers.
    ///
    /// # Returns
    /// A list of identifiers (`Ident`) describing the matching parser components.
    pub fn get_parsers(&self, origin: stypes::SessionAction) -> Vec<stypes::Ident> {
        self.parsers
            .iter()
            .filter_map(|(_, (_, desc))| {
                if desc.is_compatible(&origin) {
                    Some(desc.ident())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Returns a list of source identifiers compatible with the given session context.
    ///
    /// Filters registered sources using their `is_compatible` logic and returns
    /// only those that can be used for the given session action.
    ///
    /// # Arguments
    /// * `origin` – The session action context to filter compatible sources.
    ///
    /// # Returns
    /// A list of identifiers (`Ident`) describing the matching source components.
    pub fn get_sources(&self, origin: stypes::SessionAction) -> Vec<stypes::Ident> {
        self.sources
            .iter()
            .filter_map(|(_, (_, desc))| {
                if desc.is_compatible(&origin) {
                    Some(desc.ident())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Returns configuration schemas for the specified component UUIDs.
    ///
    /// For each component (parser or source), this method returns the `OptionsScheme` used to render configuration UI
    /// and optionally define lazy-loaded settings.
    ///
    /// # Arguments
    /// * `origin` – Session action describing the context in which components will be used.
    /// * `targets` – A list of component UUIDs to fetch configuration for.
    ///
    /// # Returns
    /// * `Ok(HashMap<Uuid, OptionsScheme>)` – Mapping from component UUIDs to their configuration schemes.
    /// * `Err(NativeError)` – If any of the UUIDs are not found in the registry.
    ///
    /// # Errors
    /// Returns a configuration error with a list of UUIDs that were not found in the registry.
    pub fn get_options(
        &self,
        origin: stypes::SessionAction,
        mut targets: Vec<Uuid>,
    ) -> Result<HashMap<Uuid, OptionsScheme>, stypes::NativeError> {
        let descriptors = self
            .descriptors()
            .into_iter()
            .filter_map(|(uuid, desc)| {
                if targets.contains(uuid) {
                    targets.retain(|v| v != uuid);
                    Some(desc)
                } else {
                    None
                }
            })
            .collect::<Vec<&dyn CommonDescriptor>>();
        if !targets.is_empty() {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!(
                    "Fail to find: {}",
                    targets
                        .iter()
                        .map(|v| v.to_string())
                        .collect::<Vec<String>>()
                        .join(", ")
                )),
            });
        }
        let mut list: HashMap<Uuid, OptionsScheme> = HashMap::new();
        for desc in descriptors.into_iter() {
            let mut options = OptionsScheme::new(desc.fields_getter(&origin)?);
            if options.has_lazy() {
                let cancel = CancellationToken::new();
                options.set_lazy(
                    desc.ident(),
                    desc.lazy_fields_getter(origin.clone(), cancel.clone()),
                    &cancel,
                );
            }
            list.insert(desc.ident().uuid, options);
        }
        Ok(list)
    }

    /// Returns the client-side render type for the specified component UUID.
    ///
    /// While typically associated with parsers (since they define the data format),
    /// the system allows any component to provide rendering output hints.
    ///
    /// # Arguments
    /// * `uuid` – The UUID of the target component.
    ///
    /// # Returns
    /// * `Ok(Some(OutputRender))` – If the parser provides render information.
    /// * `Ok(None)` – If no render is defined.
    /// * `Err(NativeError)` – If the UUID is not found or the component is not a parser.
    ///
    /// # Errors
    /// Returns a configuration error if the component is missing or not a parser.
    pub fn get_output_render(
        &self,
        uuid: &Uuid,
    ) -> Result<Option<stypes::OutputRender>, stypes::NativeError> {
        let (_, descriptor) = self.parsers.get(&uuid).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Fail to find component {uuid}")),
        })?;
        Ok(descriptor.get_render())
    }

    /// Returns the Ident of component (parser or source).
    ///
    /// # Arguments
    /// * `uuid` – The UUID of the target component.
    ///
    /// # Returns
    /// * `Some(Ident)` – If the parser or source has been found.
    /// * `None` – If no component is defined.
    pub fn get_ident(&self, uuid: &Uuid) -> Option<stypes::Ident> {
        self.descriptors().into_iter().find_map(|(inner, desc)| {
            if uuid == inner {
                Some(desc.ident())
            } else {
                None
            }
        })
    }

    /// Validates the configuration fields for a specified component within a session context.
    ///
    /// Checks each field against the component’s declared rules. This helps catch invalid or incomplete
    /// configurations before actual component instantiation.
    ///
    /// # Arguments
    /// * `origin` – The session action context.
    /// * `target` – The UUID of the component to validate.
    /// * `fields` – A list of fields provided by the client.
    ///
    /// # Returns
    /// * `Ok(HashMap<String, String>)` – Empty if validation passed; otherwise, maps field UUIDs to error messages.
    /// * `Err(NativeError)` – If the component UUID is not registered.
    ///
    /// # Errors
    /// Returns a configuration error if the component is not found.
    pub fn validate(
        &self,
        origin: &stypes::SessionAction,
        target: &Uuid,
        fields: &[stypes::Field],
    ) -> Result<HashMap<String, String>, stypes::NativeError> {
        let (_, descriptor) = self
            .descriptors()
            .into_iter()
            .find(|(uuid, _)| *uuid == target)
            .ok_or(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find component {target}")),
            })?;
        descriptor.validate(origin, fields)
    }

    /// Attempts to create instances of a parser and source component based on the session setup.
    ///
    /// This method creates fully initialized, ready-to-use instances of parser and source
    /// based on the provided configuration. It also returns a `SessionDescriptor`
    /// that contains display identifiers for tracking the session state.
    ///
    /// # Arguments
    /// * `options` – Session setup data including parser/source UUIDs and user-defined field values.
    ///
    /// # Returns
    /// * `Ok((SessionDescriptor, S, P))` – A tuple with session metadata, the source instance, and the parser instance.
    /// * `Err(NativeError)` – If any of the components cannot be found or fail to initialize.
    ///
    /// # Errors
    /// Returns configuration errors if components are missing or initialization fails.
    pub fn setup(
        &self,
        options: &stypes::SessionSetup,
    ) -> Result<(SessionDescriptor, Sources, Parsers), stypes::NativeError> {
        let Some((parser_factory, parser_descriptor)) = self.parsers.get(&options.parser.uuid)
        else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find parser {}", options.parser.uuid)),
            });
        };
        let Some((source_factory, source_descriptor)) = self.sources.get(&options.source.uuid)
        else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find source {}", options.source.uuid)),
            });
        };
        let mut descriptor = SessionDescriptor::new(
            source_descriptor.bound_ident(&options.origin, &options.source.fields),
            parser_descriptor.bound_ident(&options.origin, &options.parser.fields),
        );
        let Some((parser, desc)) = parser_factory(&options.origin, &options.parser.fields)? else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init parser {}", options.parser.uuid)),
            });
        };
        descriptor.set_parser_desc(desc);
        let Some((source, desc)) = source_factory(&options.origin, &options.source.fields)? else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init source {}", options.source.uuid)),
            });
        };
        descriptor.set_source_desc(desc);
        Ok((descriptor, source, parser))
    }

    fn descriptors(&self) -> Vec<(&Uuid, &dyn CommonDescriptor)> {
        [
            self.sources
                .iter()
                .map(|(uuid, (_, desc))| (uuid, desc.as_ref() as &dyn CommonDescriptor))
                .collect::<Vec<(&Uuid, &dyn CommonDescriptor)>>(),
            self.parsers
                .iter()
                .map(|(uuid, (_, desc))| (uuid, desc.as_ref() as &dyn CommonDescriptor))
                .collect::<Vec<(&Uuid, &dyn CommonDescriptor)>>(),
        ]
        .concat()
    }
}

impl fmt::Debug for Register {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Register")
    }
}
