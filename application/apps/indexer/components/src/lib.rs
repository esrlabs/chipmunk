mod scheme;
mod tys;

use std::{collections::HashMap, fmt};
use stypes::SessionDescriptor;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub use scheme::*;
pub use tys::*;

/// The `Components` struct serves as a central registry and initialization hub for all components
/// used in the system, such as parsers and sources. It introduces a more flexible and modular
/// architecture compared to previous hardcoded solutions (prior to version 4.x.x).
///
/// # Problem Statement
///
/// In earlier versions, parsers and sources were explicitly enumerated and directly referenced
/// in the core system. This led to several architectural drawbacks:
///
/// - Adding or removing a parser or source required changes to the core codebase.
/// - Component-related logic could not be easily isolated into self-contained modules.
/// - The frontend code had to mirror these changes, leading to tight coupling and redundancy.
///
/// # Motivation
///
/// Introducing the concept of a `Component` eliminates the need to hardcode system-wide knowledge
/// about available parsers and sources. Instead, it:
///
/// - Allows independent development and isolation of each parser/source implementation.
/// - Ensures that adding, modifying, or removing a component does not impact the core, test suite,
///   or client code.
/// - Enables extensibility without requiring major refactoring of the core logic.
///
/// # Implementation
///
/// - At the session level, an instance of `Components` is created to register all available components.
/// - When initializing a session, the client provides a list of `Uuid`s representing the desired
///   components and their configurations.
/// - `Components` is responsible for initializing these components and handing them off for further use
///   (e.g., by `MessageProducer` or for data export).
///
/// In addition, `Components` provides the following functionality:
///
/// - Lists registered components (both parsers and sources).
/// - Provides the configuration schema for any component.
/// - Performs preliminary validation of the provided configuration.
///
/// # Notes
///
/// `Components` itself does not implement any teardown or destruction logic, as this is unnecessary:
///
/// - It only stores `ComponentDescriptor` instances, which are lightweight and do not own the actual
///   component instances.
/// - Component instances are created on demand and immediately passed upwards for further use; they
///   are not retained by `Components`.
///
pub struct Components<S, P> {
    components: HashMap<Uuid, Entry<S, P>>,
}

impl<S, P> Components<S, P> {
    /// Creates an empty `Components` registry.
    ///
    /// This method initializes the `Components` structure without any registered parsers or sources.
    /// Components should be registered manually using `add_parser` or `add_source` before use.
    ///
    /// # Returns
    /// A new instance of `Components` with no components registered.
    pub fn new() -> Self {
        Self {
            components: HashMap::new(),
        }
    }

    /// Registers a parser component.
    ///
    /// This method adds a new parser to the registry. The parser is described by a `ComponentFactory`,
    /// which defines how it should be instantiated and validated.
    ///
    /// # Arguments
    /// * `descriptor` – A descriptor implementing `ComponentFactory<P>` that encapsulates parser metadata and behavior.
    ///
    /// # Returns
    /// * `Ok(())` – If the parser was successfully registered.
    /// * `Err(NativeError)` – If a component with the same UUID is already registered.
    ///
    /// # Errors
    /// Returns a configuration error if a parser with the same UUID already exists in the registry.
    pub fn add_parser<D: ComponentFactory<P> + 'static>(
        &mut self,
        descriptor: D,
    ) -> Result<(), stypes::NativeError> {
        let ident = descriptor.ident();
        if self.components.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.components
            .insert(ident.uuid, Entry::Parser(Box::new(descriptor)));
        Ok(())
    }

    /// Registers a source component.
    ///
    /// Similar to `add_parser`, this method registers a data source implementation.
    /// The descriptor provides construction logic and compatibility metadata.
    ///
    /// # Arguments
    /// * `descriptor` – A descriptor implementing `ComponentFactory<S>` for the source.
    ///
    /// # Returns
    /// * `Ok(())` – If the source was successfully registered.
    /// * `Err(NativeError)` – If a component with the same UUID is already registered.
    ///
    /// # Errors
    /// Returns a configuration error if a source with the same UUID already exists in the registry.
    pub fn add_source<D: ComponentFactory<S> + 'static>(
        &mut self,
        descriptor: D,
    ) -> Result<(), stypes::NativeError> {
        let ident = descriptor.ident();
        if self.components.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.components
            .insert(ident.uuid, Entry::Source(Box::new(descriptor)));
        Ok(())
    }

    /// Returns a list of registered components of the specified type that are compatible with a given session.
    ///
    /// This is used to retrieve a filtered list of component identifiers for parsers or sources based on their compatibility
    /// with the current session context.
    ///
    /// # Arguments
    /// * `target` – The desired component type (`Parser` or `Source`).
    /// * `origin` – The session action (e.g., export, view) to determine compatibility.
    ///
    /// # Returns
    /// * `Ok(Vec<Ident>)` – List of matching component identifiers.
    /// * `Err(NativeError)` – On internal logic failure (should be rare).
    pub fn get_components(
        &self,
        target: &stypes::ComponentType,
        origin: stypes::SessionAction,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        Ok(self
            .components
            .iter()
            .filter_map(|(_, desc)| match target {
                stypes::ComponentType::Parser => {
                    if let Entry::Parser(desc) = desc {
                        if desc.is_compatible(&origin) {
                            Some(desc.ident())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
                stypes::ComponentType::Source => {
                    if let Entry::Source(desc) = desc {
                        if desc.is_compatible(&origin) {
                            Some(desc.ident())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
            })
            .collect())
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
        let descriptors: Vec<&Entry<S, P>> = self
            .components
            .iter()
            .filter_map(|(uuid, desc)| {
                if targets.contains(uuid) {
                    targets.retain(|v| v != uuid);
                    Some(desc)
                } else {
                    None
                }
            })
            .collect();
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
        let Entry::Parser(descriptor) = self.components.get(&uuid).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Fail to find component {uuid}")),
        })?
        else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!(
                    "Fail to get render for {uuid}, because it isn't parser"
                )),
            });
        };
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
        self.components.get(&uuid).map(|entity| entity.ident())
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
        let descriptor = self.components.get(target).ok_or(stypes::NativeError {
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
    ) -> Result<(SessionDescriptor, S, P), stypes::NativeError> {
        let Some(Entry::Parser(parser)) = self.components.get(&options.parser.uuid) else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find parser {}", options.parser.uuid)),
            });
        };
        let Some(Entry::Source(source)) = self.components.get(&options.source.uuid) else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find source {}", options.source.uuid)),
            });
        };
        let mut descriptor = SessionDescriptor::new(
            source.bound_ident(&options.origin, &options.source.fields),
            source.bound_ident(&options.origin, &options.parser.fields),
        );
        let Some((parser, desc)) = parser.create(&options.origin, &options.parser.fields)? else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init parser {}", options.parser.uuid)),
            });
        };
        descriptor.set_parser_desc(desc);
        let Some((source, desc)) = source.create(&options.origin, &options.source.fields)? else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init source {}", options.source.uuid)),
            });
        };
        descriptor.set_source_desc(desc);
        Ok((descriptor, source, parser))
    }
}

impl<S, P> fmt::Debug for Components<S, P> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Components")
    }
}
