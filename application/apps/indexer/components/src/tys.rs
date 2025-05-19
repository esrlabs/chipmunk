use std::{future::Future, pin::Pin};

use crate::*;
use stypes::SourceOrigin;
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
    Parser(Box<dyn ComponentDescriptor<P>>),
    Source(Box<dyn ComponentDescriptor<S>>),
}

impl<S, P> MetadataDescriptor for Entry<S, P> {
    fn fields_getter(&self, origin: &stypes::SourceOrigin) -> FieldsResult {
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
    fn is_compatible(&self, origin: &stypes::SourceOrigin) -> bool {
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
        origin: stypes::SourceOrigin,
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
        origin: &stypes::SourceOrigin,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        match self {
            Self::Source(inner) => inner.validate(origin, fields),
            Self::Parser(inner) => inner.validate(origin, fields),
        }
    }
}

pub trait ComponentDescriptor<T>: MetadataDescriptor + Sync + Send {
    fn create(
        &self,
        _origin: &SourceOrigin,
        _options: &[stypes::Field],
    ) -> Result<Option<T>, stypes::NativeError> {
        Ok(None)
    }
}

pub trait MetadataDescriptor {
    /// Check is component is campatible with given origin
    ///
    /// * `origin` - The source origin
    ///
    /// # Returns
    ///
    /// * `true` - if component can be used with origin
    /// * `false` - if component can not be used with origin
    fn is_compatible(&self, origin: &stypes::SourceOrigin) -> bool;

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
    /// a `SourceOrigin::File` and specific field values, it could instead describe itself
    /// as a "filename" input.
    ///
    /// # Arguments
    /// * `origin` - The `stypes::SourceOrigin` that indicates the usage context.
    /// * `fields` - A slice of `stypes::Field` values representing known configuration fields.
    ///
    /// # Returns
    /// An optional `stypes::Ident` with a contextualized description, or `None` if no
    /// context-based identity is applicable.
    fn bound_ident(
        &self,
        _origin: &stypes::SourceOrigin,
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
    fn fields_getter(&self, origin: &stypes::SourceOrigin) -> FieldsResult {
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
        origin: stypes::SourceOrigin,
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
        origin: &stypes::SourceOrigin,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        HashMap::new()
    }
}
