use std::{collections::HashMap, fmt};

use file_tools::is_path_binary;
use stypes::{NativeError, SessionDescriptor};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use descriptor::*;
use parsers::Parsers;
use sources::Sources;

/// The `Register` struct holds information about all available source and parser components
/// in the system. It is used as a central registry during initialization and component creation.
///
/// Each entry associates a unique identifier (`Uuid`) with the corresponding factory object.
/// These factories are responsible for creating concrete instances of sources and parsers
/// and also act as their descriptors by implementing the associated traits.
///
/// - `sources`: A map of source factories. Each factory implements `SourceFactory<Sources>`
///   and provides metadata and construction logic for a specific source type.
/// - `parsers`: A map of parser factories. Each factory implements `ParserFactory<Parsers>`
///   and defines both the parser metadata and instantiation logic.
///
/// By storing trait objects (`Box<dyn ...>`), the registry supports dynamic extensibility,
/// including plugin-based components.
pub struct Register {
    sources: HashMap<Uuid, Box<dyn SourceFactory<Sources>>>,
    parsers: HashMap<Uuid, Box<dyn ParserFactory<Parsers>>>,
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

    /// Registers a new parser factory in the registry.
    ///
    /// The factory must implement the `ParserFactory<Parsers>` trait and will be stored
    /// under its associated UUID. If a parser with the same UUID has already been registered,
    /// an error of kind `Configuration` will be returned.
    ///
    /// # Type Parameters
    /// - `D`: A concrete type that implements `ParserFactory<Parsers>`.
    ///
    /// # Errors
    /// Returns `NativeError` if a parser with the same UUID is already registered.
    pub fn add_parser<D: ParserFactory<Parsers> + 'static>(
        &mut self,
        factory: D,
    ) -> Result<(), stypes::NativeError> {
        let ident = factory.ident();
        if self.parsers.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.parsers.insert(ident.uuid, Box::new(factory));
        Ok(())
    }

    /// Registers a new source factory in the registry.
    ///
    /// The factory must implement the `SourceFactory<Sources>` trait and will be stored
    /// under its associated UUID. If a source with the same UUID has already been registered,
    /// an error of kind `Configuration` will be returned.
    ///
    /// # Type Parameters
    /// - `D`: A concrete type that implements `SourceFactory<Sources>`.
    ///
    /// # Errors
    /// Returns `NativeError` if a source with the same UUID is already registered.
    pub fn add_source<D: SourceFactory<Sources> + 'static>(
        &mut self,
        factory: D,
    ) -> Result<(), stypes::NativeError> {
        let ident: stypes::Ident = factory.ident();
        if self.sources.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.sources.insert(ident.uuid, Box::new(factory));
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
            .filter_map(|(_, entity)| {
                if entity.is_compatible(&origin) {
                    Some(entity.ident())
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
            .filter_map(|(_, entity)| {
                if entity.is_compatible(&origin) {
                    Some(entity.ident())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Returns the identifiers of all registered components of a given type.
    ///
    /// This method retrieves the list of identifiers (`Ident`) for all components
    /// that match the specified [`ComponentType`], such as parsers or sources. The
    /// results can be filtered based on the provided [`SessionAction`] origin,
    /// allowing context-specific queries.
    ///
    /// # Arguments
    ///
    /// * `ty` - The type of component to retrieve (e.g., `Parser` or `Source`).
    /// * `origin` - The session origin used to filter components by their scope or context.
    ///
    /// # Returns
    ///
    /// A `Vec<Ident>` containing the identifiers of all matching components.
    ///
    /// # See Also
    ///
    /// [`get_parsers`], [`get_sources`]
    pub fn get_components(
        &self,
        ty: stypes::ComponentType,
        origin: stypes::SessionAction,
    ) -> Vec<stypes::Ident> {
        match ty {
            stypes::ComponentType::Parser => self.get_parsers(origin),
            stypes::ComponentType::Source => self.get_sources(origin),
        }
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
            .filter_map(|(uuid, entity)| {
                if targets.contains(uuid) {
                    targets.retain(|v| v != uuid);
                    Some(entity)
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
        for entity in descriptors.into_iter() {
            let mut options = OptionsScheme::new(entity.fields_getter(&origin)?);
            if options.has_lazy() {
                let cancel = CancellationToken::new();
                options.set_lazy(
                    entity.ident(),
                    entity.lazy_fields_getter(origin.clone(), cancel.clone()),
                    &cancel,
                );
            }
            list.insert(entity.ident().uuid, options);
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
        let descriptor = self.parsers.get(uuid).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Fail to find component {uuid}")),
        })?;
        Ok(descriptor.get_render())
    }

    /// Checks whether the specified source supports the Source Data Exchange (SDE) mechanism.
    ///
    /// The SDE mechanism determines whether the user is allowed to send data to the source.
    /// This method queries the source descriptor by its UUID and evaluates SDE support
    /// in the context of the given session origin.
    ///
    /// # Arguments
    ///
    /// * `uuid` - The unique identifier of the source component.
    /// * `origin` - The session context used to evaluate access permissions.
    ///
    /// # Returns
    ///
    /// `Ok(true)` if the source supports SDE; `Ok(false)` otherwise.  
    /// Returns an error if the source with the specified UUID is not found.
    ///
    /// # Errors
    ///
    /// Returns [`NativeError`] with kind [`Configuration`] if the source is not registered.
    pub fn is_sde_supported(
        &self,
        uuid: &Uuid,
        origin: &stypes::SessionAction,
    ) -> Result<bool, stypes::NativeError> {
        let descriptor = self.sources.get(uuid).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Fail to find component {uuid}")),
        })?;
        Ok(descriptor.is_sde_supported(origin))
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
        self.descriptors().into_iter().find_map(|(inner, entity)| {
            if uuid == inner {
                Some(entity.ident())
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

    /// Returns a list of source and parser components that are compatible with the given session context
    /// and can be used without explicit configuration.
    ///
    /// This method is designed to support "quick start" scenarios, where the user initiates a session
    /// (e.g., opening a file) without manually selecting or configuring components. It filters available
    /// sources and parsers based on the following criteria:
    ///
    /// - The component must declare compatibility with the provided [`SessionAction`].
    /// - The component must support default options (i.e., `get_default_options()` returns `Some`).
    /// - The component's IO type must match the detected IO data type inferred from the session context
    ///   (e.g., plain text or raw binary).
    ///
    /// This method is typically used to automatically select a default setup when the user opens
    /// a file (such as a text or DLT file), allowing immediate parsing and display without prompting
    /// for configuration.
    ///
    /// # Arguments
    ///
    /// * `origin` - The session context (e.g., a file or set of files) used to infer compatibility and IO type.
    ///
    /// # Returns
    ///
    /// A [`ComponentsList`] containing identifiers of all matching sources and parsers.
    /// If no fully compatible combination is found, an empty list is returned.
    ///
    /// # Errors
    ///
    /// Returns a [`NativeError`] if binary detection fails for one or more files.
    ///
    /// # Behavior
    ///
    /// - For a single file: detects whether the file is binary or plain text.
    /// - For multiple files: only returns components if all are plain text, or all are binary.
    ///   Mixed types result in an empty list.
    /// - For unsupported session types (e.g., `Source`, `ExportRaw`), returns an empty list.
    pub fn get_compatible_setup(
        &self,
        origin: &stypes::SessionAction,
    ) -> Result<stypes::ComponentsList, stypes::NativeError> {
        let io_type = match origin {
            stypes::SessionAction::File(filename) => {
                if is_path_binary(filename).map_err(|err| NativeError::io(&err.to_string()))? {
                    stypes::IODataType::Raw
                } else {
                    stypes::IODataType::PlaitText
                }
            }
            stypes::SessionAction::Files(files) => {
                let mut bin_count = 0;
                for filename in files {
                    bin_count += if is_path_binary(filename)
                        .map_err(|err| NativeError::io(&err.to_string()))?
                    {
                        1
                    } else {
                        0
                    };
                }
                if files.len() == bin_count {
                    stypes::IODataType::Raw
                } else if !files.is_empty() && bin_count == 0 {
                    stypes::IODataType::PlaitText
                } else {
                    return Ok(stypes::ComponentsList::default());
                }
            }
            stypes::SessionAction::Source | stypes::SessionAction::ExportRaw(..) => {
                return Ok(stypes::ComponentsList::default())
            }
        };
        let sources: Vec<stypes::Ident> = self
            .sources
            .iter()
            .filter_map(|(_, entity)| {
                if entity.is_compatible(origin)
                    && entity.get_default_options(origin).is_some()
                    && entity.ident().io == io_type
                {
                    Some(entity.ident())
                } else {
                    None
                }
            })
            .collect();
        let parsers: Vec<stypes::Ident> = self
            .parsers
            .iter()
            .filter_map(|(_, entity)| {
                if entity.is_compatible(origin)
                    && entity.get_default_options(origin).is_some()
                    && entity.ident().io == io_type
                {
                    Some(entity.ident())
                } else {
                    None
                }
            })
            .collect();

        Ok(stypes::ComponentsList { parsers, sources })
    }

    /// Returns the default configuration options for the specified component, or an error if none are available.
    ///
    /// This method retrieves the default options for a parser or source component in the context of
    /// the given [`SessionAction`]. It is used to determine whether the component can be instantiated
    /// automatically, without requiring manual configuration by the user.
    ///
    /// Unlike earlier versions, this method no longer returns `Option`. If the component does not
    /// support default options (i.e., it **must** be explicitly configured), the method returns a
    /// [`NativeError`] indicating that it cannot be used in automatic setup scenarios.
    ///
    /// # Arguments
    ///
    /// * `origin` - The session context used to evaluate compatibility and scope.
    /// * `target` - The UUID of the component for which default options are requested.
    ///
    /// # Returns
    ///
    /// * `Ok(FieldList)` - A list of fields to be used for instantiating the component.
    ///   If the list is empty, it means the component has no configurable options, but can still be used by default.
    /// * `Err(NativeError)` - If the component:
    ///   - is not registered,
    ///   - does not support default options (and therefore cannot be used blindly).
    ///
    /// # Semantics
    ///
    /// - Empty `FieldList` (`FieldList(vec![])`) means the component has no settings but **is safe to use as default**.
    /// - An error means the component **requires explicit configuration** and must not be auto-selected.
    ///
    /// # Errors
    ///
    /// Returns a [`NativeError`] with kind `Configuration` if:
    /// - The component is not found,
    /// - The component does not support default options in the given session context.
    pub fn get_default_options(
        &self,
        origin: &stypes::SessionAction,
        target: &Uuid,
    ) -> Result<stypes::FieldList, stypes::NativeError> {
        let (_, descriptor) = self
            .descriptors()
            .into_iter()
            .find(|(uuid, _)| *uuid == target)
            .ok_or(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find component {target}")),
            })?;
        descriptor
            .get_default_options(origin)
            .map(|fields| stypes::FieldList(fields))
            .ok_or(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!(
                    "Component {target} doesn't support default options"
                )),
            })
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
        let Some(parser_factory) = self.parsers.get(&options.parser.uuid) else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find parser {}", options.parser.uuid)),
            });
        };
        let Some(source_factory) = self.sources.get(&options.source.uuid) else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find source {}", options.source.uuid)),
            });
        };
        let mut descriptor = SessionDescriptor::new(
            source_factory.bound_ident(&options.origin, &options.source.fields),
            parser_factory.bound_ident(&options.origin, &options.parser.fields),
        );
        let Some((parser, desc)) =
            parser_factory.create(&options.origin, &options.parser.fields)?
        else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init parser {}", options.parser.uuid)),
            });
        };
        descriptor.set_parser_desc(desc);
        let Some((source, desc)) =
            source_factory.create(&options.origin, &options.source.fields)?
        else {
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
                .map(|(uuid, entity)| (uuid, entity.as_ref() as &dyn CommonDescriptor))
                .collect::<Vec<(&Uuid, &dyn CommonDescriptor)>>(),
            self.parsers
                .iter()
                .map(|(uuid, entity)| (uuid, entity.as_ref() as &dyn CommonDescriptor))
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
