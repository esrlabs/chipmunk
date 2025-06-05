use std::{future::Future, pin::Pin};

use crate::*;
use stypes::SessionAction;
use tokio_util::sync::CancellationToken;

/// A type alias for a result containing a vector of field descriptors or a native error.
///
/// # Variants
///
/// * `Ok(Vec<stypes::FieldDesc>)` - A vector containing field descriptors.
/// * `Err(stypes::NativeError)` - An error indicating a problem while retrieving the fields.
pub type FieldsResult = Result<Vec<stypes::FieldDesc>, stypes::NativeError>;

#[derive(Debug)]
/// A type alias representing the result of obtaining a single static field description.
pub enum StaticFieldResult {
    Success(stypes::StaticFieldDesc),
    Failed(stypes::FieldLoadingError),
}

impl StaticFieldResult {
    pub fn is_ok(&self) -> bool {
        matches!(self, StaticFieldResult::Success(..))
    }
    pub fn ok(self) -> Option<stypes::StaticFieldDesc> {
        match self {
            Self::Success(desc) => Some(desc),
            Self::Failed(..) => None,
        }
    }
    pub fn err(self) -> Option<stypes::FieldLoadingError> {
        match self {
            Self::Success(..) => None,
            Self::Failed(err) => Some(err),
        }
    }
}

/// A type alias for a result containing a vector of static field results or a native error.
///
/// # Variants
///
/// * `Ok(Vec<StaticFieldResult>)` - A vector containing static field results.
/// * `Err(stypes::NativeError)` - An error indicating a problem while retrieving static fields.
pub type StaticFieldsResult = Result<Vec<StaticFieldResult>, stypes::NativeError>;
/// A type alias for an asynchronous task that yields a static fields result.
///
/// Represents a future that will eventually produce a `StaticFieldsResult`.
/// The task is wrapped in a `Pin<Box<dyn Future + Send>>`, allowing for asynchronous
/// execution while being safely pinned in memory.
///
/// # Output
///
/// * `StaticFieldsResult` - A result containing static field data or a native error.
pub type LazyFieldsTask = Pin<Box<dyn Future<Output = StaticFieldsResult> + Send>>;

pub enum Entry<S, P> {
    Parser(Box<dyn ComponentFactory<P>>),
    Source(Box<dyn ComponentFactory<S>>),
}

impl<S, P> ComponentDescriptor for Entry<S, P> {
    fn get_render(&self) -> Option<stypes::OutputRender> {
        match self {
            Self::Source(inner) => inner.get_render(),
            Self::Parser(inner) => inner.get_render(),
        }
    }
    fn fields_getter(&self, origin: &stypes::SessionAction) -> FieldsResult {
        match self {
            Self::Source(inner) => inner.fields_getter(origin),
            Self::Parser(inner) => inner.fields_getter(origin),
        }
    }
    fn ident(&self) -> stypes::Ident {
        match self {
            Self::Source(inner) => inner.ident(),
            Self::Parser(inner) => inner.ident(),
        }
    }
    fn is_compatible(&self, origin: &stypes::SessionAction) -> bool {
        match self {
            Self::Source(inner) => inner.is_compatible(origin),
            Self::Parser(inner) => inner.is_compatible(origin),
        }
    }
    fn is_ty(&self, ty: &stypes::ComponentType) -> bool {
        match self {
            Self::Source(inner) => inner.is_ty(ty),
            Self::Parser(inner) => inner.is_ty(ty),
        }
    }
    fn lazy_fields_getter(
        &self,
        origin: stypes::SessionAction,
        cancel: CancellationToken,
    ) -> LazyFieldsTask {
        match self {
            Self::Source(inner) => inner.lazy_fields_getter(origin, cancel),
            Self::Parser(inner) => inner.lazy_fields_getter(origin, cancel),
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        match self {
            Self::Source(inner) => inner.ty(),
            Self::Parser(inner) => inner.ty(),
        }
    }
    fn validate(
        &self,
        origin: &stypes::SessionAction,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        match self {
            Self::Source(inner) => inner.validate(origin, fields),
            Self::Parser(inner) => inner.validate(origin, fields),
        }
    }
}

/// Defines a factory interface for creating instances of components.
///
/// In the application architecture, components (such as parsers, sources, etc.)
/// are not instantiated directly. Instead, component instantiation is handled
/// by the `Components` controller, which creates component instances based on
/// registrations made during system initialization.
///
/// This level of indirection is a key architectural decision, as it allows
/// components to remain decoupled from the application core. This makes it
/// possible to replace or update components without modifying the core logic.
pub trait ComponentFactory<T>: ComponentDescriptor + Sync + Send {
    /// Creates an instance of the component of type `T`.
    ///
    /// # Arguments
    /// * `origin` - A reference to a `SessionAction` representing the creation context.
    ///   For example, it could point to a file, a group of files, or any other data source.
    /// * `options` - A slice of `stypes::Field` values representing component options or settings.
    ///
    /// # Returns
    /// * `Ok(Some(T))` if the component was successfully created.
    /// * `Ok(None)` if the factory declined to create a component for the given context.
    /// * `Err(stypes::NativeError)` if an error occurred during creation.
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[stypes::Field],
    ) -> Result<Option<T>, stypes::NativeError> {
        Ok(None)
    }
}

/// Describes a component in terms of its identity, configuration schema,
/// validation logic, support for lazy-loading configuration, and its type within the system.
///
/// The `ComponentDescriptor` trait serves as an abstraction layer that decouples
/// the core system from concrete component implementations. Instead of referring
/// to component types directly (e.g., a specific parser or source), the application
/// interacts with components through their descriptors.
///
/// This design enables a fully modular architecture where, for example, a session
/// can be created using a parser and source identified solely by their UUIDs.
/// The actual parser and source implementations remain hidden behind the descriptor,
/// making it possible to swap, reconfigure, or isolate components without touching
/// the application core.
pub trait ComponentDescriptor {
    fn get_render(&self) -> Option<stypes::OutputRender> {
        None
    }

    /// Check is component is campatible with given origin
    ///
    /// * `origin` - The source origin
    ///
    /// # Returns
    ///
    /// * `true` - if component can be used with origin
    /// * `false` - if component can not be used with origin
    fn is_compatible(&self, origin: &stypes::SessionAction) -> bool;

    /// Returns a general description of the component as a static, standalone entity.
    ///
    /// This method provides a neutral, context-independent identifier that can be used
    /// to list the component as an available option for the user. Since the actual usage
    /// context is unknown at this stage, the returned description should be as general
    /// as possible.
    ///
    /// # Returns
    /// A `stypes::Ident` representing the generic identity of the component.
    fn ident(&self) -> stypes::Ident;

    /// Returns a context-specific description of the component, based on its usage origin and known fields.
    ///
    /// Unlike `ident`, this method considers how the component is being used, such as what
    /// data source is involved and which fields are already known. For example, a `source::Raw`
    /// component might normally describe itself as a "binary reader", but in the context of
    /// a `SessionAction::File` and specific field values, it could instead describe itself
    /// as a "filename" input.
    ///
    /// # Arguments
    /// * `origin` - The `stypes::SessionAction` that indicates the usage context.
    /// * `fields` - A slice of `stypes::Field` values representing known configuration fields.
    ///
    /// # Returns
    /// An optional `stypes::Ident` with a contextualized description, or `None` if no
    /// context-based identity is applicable.
    fn bound_ident(
        &self,
        _origin: &stypes::SessionAction,
        _fields: &[stypes::Field],
    ) -> stypes::Ident {
        self.ident()
    }

    /// Retrieves the type of the component.
    ///
    /// # Returns
    ///
    /// * `stypes::ComponentType` - The type of the component (e.g., parser, source).
    fn ty(&self) -> stypes::ComponentType;

    /// Checks if the component's type matches the given type.
    ///
    /// # Arguments
    ///
    /// * `ty` - A reference to the type to check against.
    ///
    /// # Returns
    ///
    /// * `true` if the component type matches the given type.
    /// * `false` otherwise.
    fn is_ty(&self, ty: &stypes::ComponentType) -> bool {
        &self.ty() == ty
    }

    /// Retrieves the static field descriptors for the component.
    ///
    /// This method returns a list of field descriptors that are directly available without
    /// requiring asynchronous loading.
    ///
    /// # Arguments
    ///
    /// * `origin` - The source origin related to the component.
    ///
    /// # Returns
    ///
    /// * `FieldsResult` - A result containing a vector of field descriptors or a native error.
    #[allow(unused)]
    fn fields_getter(&self, origin: &stypes::SessionAction) -> FieldsResult {
        Ok(Vec::new())
    }

    /// Retrieves the lazy loading task for fields that require asynchronous fetching.
    ///
    /// This method returns a future that asynchronously loads the component's fields.
    ///
    /// # Arguments
    ///
    /// * `origin` - The source origin from which the data will be loaded.
    /// * `cancel` - A cancellation token that can interrupt the loading process.
    ///
    /// # Returns
    ///
    /// * `LazyFieldsTask` - An asynchronous task that will eventually yield the field descriptors.
    #[allow(unused)]
    fn lazy_fields_getter(
        &self,
        origin: stypes::SessionAction,
        cancel: CancellationToken,
    ) -> LazyFieldsTask {
        Box::pin(async { Ok(Vec::new()) })
    }

    /// Validates the provided settings for the component.
    ///
    /// This method checks whether the given fields are valid according to the component's
    /// configuration rules. Since validation is optional, the default implementation
    /// returns an empty map, indicating no validation issues.
    ///
    /// # Arguments
    ///
    /// * `origin` - The source origin related to the component.
    /// * `fields` - A slice of fields to be validated.
    ///
    /// # Returns
    ///
    /// * `HashMap<String, String>` - A map where keys are field names and values are
    ///   error messages, if any. An empty map means no validation errors.
    #[allow(unused)]
    fn validate(
        &self,
        origin: &stypes::SessionAction,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        HashMap::new()
    }
}

#[derive(Debug, Default)]
pub struct ValidationErrors {
    errors: HashMap<String, String>,
}

impl ValidationErrors {
    pub fn insert_field_bound_err(&mut self, field: &str, msg: String) {
        self.errors.insert(field.to_owned(), msg);
    }
    pub fn insert_values_bound_err(&mut self, field: &str, idx: usize) {}
}
