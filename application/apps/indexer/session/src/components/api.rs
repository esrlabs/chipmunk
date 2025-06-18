use std::collections::HashMap;

use components::{LazyLoadingResult, LazyLoadingTaskMeta};
use stypes::{Ident, NativeError, SessionAction};
use tokio::sync::oneshot;
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
}
