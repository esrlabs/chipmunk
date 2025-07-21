pub use crate::*;
use tokio::select;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

/// Represents the result of a lazy field loading operation.
///
/// This enum is used to capture the outcome of asynchronously loading field descriptions.
/// The result can either contain the loaded fields or indicate that the operation was cancelled.
///
/// # Variants
///
/// * `Fields(Vec<StaticFieldResult>)` - A vector of static field results successfully loaded.
/// * `Cancelled` - Indicates that the lazy loading operation was cancelled before completion.
#[derive(Debug)]
pub enum LazyLoadingResult {
    Fields(Vec<StaticFieldResult>),
    Cancelled,
}

/// Metadata associated with a lazy loading operation for field schemas.
///
/// This struct contains information required to manage and track the process of
/// lazy loading field descriptions. It includes a unique identifier, component
/// identification, a cancellation token, and a list of field identifiers to be loaded.
///
/// # Fields
///
/// * `uuid` - A unique identifier for the lazy loading operation.
/// * `ident` - An identifier of the component initiating the loading process.
/// * `cancel` - A cancellation token that can be used to prematurely terminate the loading task.
/// * `fields` - A list of field identifiers that will be loaded as part of this operation.
#[derive(Debug, Clone)]
pub struct LazyLoadingTaskMeta {
    /// A unique identifier for the lazy loading operation.
    pub uuid: Uuid,
    /// An identifier of the component initiating the loading process.
    pub ident: stypes::Ident,
    /// A cancellation token that allows for premature termination of the loading task.
    pub cancel: CancellationToken,
    /// A list of field identifiers to be loaded during the operation.
    pub fields: Vec<String>,
}

impl LazyLoadingTaskMeta {
    /// Checks if the lazy loading task contains any of the specified field identifiers.
    ///
    /// This method iterates over the internal list of field identifiers and checks
    /// whether any of them are present in the given slice of field identifiers.
    ///
    /// # Arguments
    ///
    /// * `fields` - A slice of `String` identifiers to check against the stored field list.
    ///
    /// # Returns
    ///
    /// * `true` if at least one of the given field identifiers is found in the task's field list.
    /// * `false` otherwise.
    pub fn contains(&self, fields: &[String]) -> bool {
        self.fields.iter().any(|id| fields.contains(id))
    }

    /// Retrieves the unique identifier (UUID) of the component owner associated with this task.
    ///
    /// This method returns the UUID that uniquely identifies the component
    /// responsible for initiating the lazy loading operation.
    ///
    /// # Returns
    ///
    /// * `Uuid` - The unique identifier of the component owner.
    pub fn owner(&self) -> Uuid {
        self.ident.uuid
    }
}

/// Represents a task for lazy loading of configuration schema fields.
///
/// This struct encapsulates metadata and an optional asynchronous task related to the lazy loading
/// of settings. The lazy loading task is used when the component requires field data that needs
/// to be fetched asynchronously.
///
/// # Fields
///
/// * `meta` - Metadata related to the lazy loading operation, including task ID, component ID,
///   cancellation token, and the list of fields to be loaded.
/// * `task` - An optional asynchronous task responsible for retrieving the field data.
///   The task is wrapped in `Option` to allow for cases where it may not be initialized or has
///   already completed.
pub struct LazyLoadingTask {
    /// Metadata related to the lazy loading operation.
    meta: LazyLoadingTaskMeta,
    /// An optional asynchronous task responsible for loading the fields.
    task: Option<LazyFieldsTask>,
}

impl LazyLoadingTask {
    /// Creates a new lazy loading task for retrieving configuration schema fields.
    ///
    /// This method initializes the task with metadata and an asynchronous task function.
    /// The task can be canceled using the provided cancellation token.
    ///
    /// # Arguments
    ///
    /// * `ident` - An identifier of the component for which the settings are being loaded.
    /// * `task` - The asynchronous task responsible for loading the fields.
    /// * `cancel` - A reference to a cancellation token that can interrupt the loading process.
    /// * `fields` - A vector of field identifiers to be lazily loaded.
    ///
    /// # Returns
    ///
    /// * `Self` - A new instance of `LazyLoadingTask`.
    pub fn new(
        ident: stypes::Ident,
        task: LazyFieldsTask,
        cancel: &CancellationToken,
        fields: Vec<String>,
    ) -> Self {
        Self {
            meta: LazyLoadingTaskMeta {
                uuid: Uuid::new_v4(),
                ident,
                cancel: cancel.clone(),
                fields,
            },
            task: Some(task),
        }
    }

    /// Retrieves the metadata associated with the lazy loading task.
    ///
    /// This method returns a cloned copy of the metadata, which includes the task's unique ID,
    /// component identifier, cancellation token, and field list.
    ///
    /// # Returns
    ///
    /// * `LazyLoadingTaskMeta` - The metadata associated with the task.
    pub fn get_meta(&self) -> LazyLoadingTaskMeta {
        self.meta.clone()
    }

    /// Executes the lazy loading task and waits for its completion.
    ///
    /// This asynchronous method either completes the field loading or detects task cancellation.
    ///
    /// # Returns
    ///
    /// * `Ok(LazyLoadingResult::Fields(Vec<StaticFieldResult>))` - If the fields were successfully loaded.
    /// * `Ok(LazyLoadingResult::Cancelled)` - If the loading operation was cancelled.
    /// * `Err(stypes::NativeError)` - If there was an error during the loading process.
    ///
    /// # Behavior
    ///
    /// The method uses asynchronous selection to await either the task's completion or a cancellation signal.
    /// If the cancellation token signals cancellation before the task completes, the method returns
    /// `LazyLoadingResult::Cancelled`. Otherwise, it returns the loaded fields.
    ///
    /// # Note
    ///
    /// The cancellation mechanism is designed to be safe and non-blocking.
    /// The decision on whether to control cancellation at the parser/source level or delegate it
    /// to a higher layer is still under consideration.
    pub async fn wait(&mut self) -> Result<LazyLoadingResult, stypes::NativeError> {
        let Some(task) = self.task.take() else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!(
                    "Settings already requested for {}",
                    self.meta.ident.name
                )),
            });
        };
        // TODO: cancel safe
        select! {
            _ = self.meta.cancel.cancelled() => {
                // TODO: the question - shell we controll cancellation about parser/source,
                // or we can deligate it? I think we should controll it above.
                Ok(LazyLoadingResult::Cancelled)
            }
            fields = task => {
                let fields = fields.map_err(|_| stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::ChannelError,
                    message: Some(format!(
                        "Fail to get settings for {}",
                        self.meta.ident.name
                    )),
                })?;
                // Check one more time in case if cancel was catched first on level of parser/source
                if self.meta.cancel.is_cancelled() {
                    Ok(LazyLoadingResult::Cancelled)
                } else {
                    Ok(LazyLoadingResult::Fields(fields))
                }
            }
        }
    }
}

/// Represents the configuration schema of a component.
///
/// This struct defines the structure of a component's settings, including both
/// static fields and an optional lazy loading task for fields that require asynchronous loading.
///
/// # Fields
///
/// * `spec` - A vector containing field descriptors that define the structure and types of settings.
/// * `lazy` - An optional task that handles the lazy loading of settings fields that are not immediately available.
pub struct OptionsScheme {
    /// Describes all the fields in the component's configuration.
    pub spec: Vec<stypes::FieldDesc>,
    /// Contains a task responsible for the "lazy" loading of specific configuration fields.
    pub lazy: Option<LazyLoadingTask>,
}

impl OptionsScheme {
    /// Creates a new `OptionsScheme` with the given field descriptors.
    ///
    /// This method initializes a new instance of `OptionsScheme` with the specified static fields
    /// and no lazy loading task.
    ///
    /// # Arguments
    ///
    /// * `spec` - A vector of field descriptors (`stypes::FieldDesc`) that define the component's settings.
    ///
    /// # Returns
    ///
    /// * `Self` - A new `OptionsScheme` instance.
    pub fn new(spec: Vec<stypes::FieldDesc>) -> Self {
        Self { spec, lazy: None }
    }

    /// Sets a lazy loading task for the current options scheme.
    ///
    /// This method associates a lazy loading task with the current scheme, allowing for
    /// asynchronous loading of configuration fields that are not immediately available.
    ///
    /// # Arguments
    ///
    /// * `ident` - An identifier of the component for which the lazy task is created.
    /// * `task` - An asynchronous task responsible for fetching lazy field data.
    /// * `cancel` - A cancellation token that can interrupt the lazy loading process.
    pub fn set_lazy(
        &mut self,
        ident: stypes::Ident,
        task: LazyFieldsTask,
        cancel: &CancellationToken,
    ) {
        self.lazy = Some(LazyLoadingTask::new(ident, task, cancel, self.lazy_uuids()));
    }

    /// Extracts and removes all field descriptors from the options scheme.
    ///
    /// This method drains the vector of field descriptors, effectively emptying it,
    /// and returns the collected fields as a new vector.
    ///
    /// # Returns
    ///
    /// * `Vec<stypes::FieldDesc>` - A vector containing the extracted field descriptors.
    pub fn extract_spec(&mut self) -> Vec<stypes::FieldDesc> {
        self.spec.drain(..).collect::<Vec<stypes::FieldDesc>>()
    }

    /// Checks whether the options scheme contains any lazy fields.
    ///
    /// This method iterates over the field descriptors and checks for any field that
    /// is marked as lazy, indicating that it requires asynchronous loading.
    ///
    /// # Returns
    ///
    /// * `true` if the scheme contains at least one lazy field.
    /// * `false` if all fields are static.
    pub fn has_lazy(&self) -> bool {
        self.spec
            .iter()
            .any(|f| matches!(f, stypes::FieldDesc::Lazy(..)))
    }

    /// Retrieves a list of UUIDs for all lazy fields in the options scheme.
    ///
    /// This method filters the field descriptors to extract only the IDs of lazy fields
    /// and returns them as a vector of strings.
    ///
    /// # Returns
    ///
    /// * `Vec<String>` - A vector containing the UUIDs of lazy fields.
    fn lazy_uuids(&self) -> Vec<String> {
        self.spec
            .iter()
            .filter_map(|f| {
                if let stypes::FieldDesc::Lazy(f) = f {
                    Some(f.id.to_owned())
                } else {
                    None
                }
            })
            .collect()
    }
}
