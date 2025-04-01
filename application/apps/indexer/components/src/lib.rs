mod tys;

use tokio::select;
use tokio_util::sync::CancellationToken;
pub use tys::*;

use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug)]
pub enum LazyLoadingResult {
    Feilds(Vec<StaticFieldResult>),
    Cancelled,
}

#[derive(Debug, Clone)]
pub struct LazyLoadingTaskMeta {
    pub uuid: Uuid,
    pub ident: stypes::Ident,
    pub cancel: CancellationToken,
    pub fields: Vec<String>,
}

impl LazyLoadingTaskMeta {
    pub fn contains(&self, fields: &[String]) -> bool {
        self.fields.iter().any(|id| fields.contains(id))
    }
    pub fn owner(&self) -> Uuid {
        self.ident.uuid
    }
}

pub struct LazyLoadingTask {
    meta: LazyLoadingTaskMeta,
    task: Option<LazyFieldsTask>,
}

impl LazyLoadingTask {
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

    pub fn get_meta(&self) -> LazyLoadingTaskMeta {
        self.meta.clone()
    }

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
                    Ok(LazyLoadingResult::Feilds(fields))
                }
            }
        }
    }
}

pub struct Options {
    pub statics: Vec<stypes::FieldDesc>,
    pub lazy: Option<LazyLoadingTask>,
}

impl Options {
    pub fn new(statics: Vec<stypes::FieldDesc>) -> Self {
        Self {
            statics,
            lazy: None,
        }
    }
    pub fn set_lazy(
        &mut self,
        ident: stypes::Ident,
        task: LazyFieldsTask,
        cancel: &CancellationToken,
    ) {
        self.lazy = Some(LazyLoadingTask::new(ident, task, cancel, self.lazy_uuids()));
    }
    pub fn has_lazy(&self) -> bool {
        self.statics
            .iter()
            .any(|f| matches!(f, stypes::FieldDesc::Lazy(..)))
    }

    fn lazy_uuids(&self) -> Vec<String> {
        self.statics
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

#[derive(Default)]
pub struct Components {
    components: HashMap<Uuid, Box<dyn ComponentDescriptor + Send + 'static>>,
}

impl Components {
    pub fn register<D: ComponentDescriptor + Send + 'static>(
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
        self.components.insert(ident.uuid, Box::new(descriptor));
        Ok(())
    }

    pub fn get_components(
        &self,
        target: &stypes::ComponentType,
        _source_origin: stypes::SourceOrigin,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        // TODO: "ask" source/parser based on origin
        Ok(self
            .components
            .iter()
            .filter_map(|(_, desc)| {
                if desc.is_ty(target) {
                    Some(desc.ident())
                } else {
                    None
                }
            })
            .collect())
    }

    pub fn get_options(
        &self,
        origin: stypes::SourceOrigin,
        mut targets: Vec<Uuid>,
    ) -> Result<Vec<Options>, stypes::NativeError> {
        let descriptors: Vec<&Box<dyn ComponentDescriptor + Send + 'static>> = self
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
        let mut list: Vec<Options> = Vec::new();
        for desc in descriptors.into_iter() {
            let mut options = Options::new(desc.fields_getter(&origin)?);
            if options.has_lazy() {
                let cancel = CancellationToken::new();
                options.set_lazy(
                    desc.ident(),
                    desc.lazy_fields_getter(origin.clone(), cancel.clone()),
                    &cancel,
                );
            }
            list.push(options);
        }
        Ok(list)
    }
}
