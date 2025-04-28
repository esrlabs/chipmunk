use std::{future::Future, pin::Pin};

use crate::*;
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

/// A trait responsible for registering a component within the system.
///
/// Registration of a component is performed only once during the application's lifetime.
/// Implementors of this trait define the mechanism for adding their component to the system registry.
pub trait Component {
    /// Registers the component in the system.
    ///
    /// This method is responsible for adding the component to the given collection of components.
    /// It should be called only once per application runtime.
    ///
    /// # Arguments
    ///
    /// * `components` - A mutable reference to the system's component registry.
    ///
    /// # Returns
    ///
    /// * `Ok(())` if the registration was successful.
    /// * `Err(stypes::NativeError)` if an error occurred during registration.
    fn register(components: &mut Components) -> Result<(), stypes::NativeError>;
}

/// A trait that defines the characteristics and behavior of a component.
///
/// Each component (such as a parser, source, etc.) must specify its type and identifier.
/// Additional parameters are optional, meaning a component might have no settings at all
/// or only static settings. Similarly, the validation procedure for settings is optional.
///
/// This trait provides a standardized way to describe a component, including its type,
/// identifier, field getters, lazy field loaders, and optional validation logic.
pub trait ComponentDescriptor {
    /// Retrieves the unique identifier of the component.
    ///
    /// # Returns
    ///
    /// * `stypes::Ident` - The unique identifier for the component.
    fn ident(&self) -> stypes::Ident;

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
