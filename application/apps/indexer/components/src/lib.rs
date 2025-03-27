mod tys;

use tokio::select;
use tokio_util::sync::CancellationToken;
pub use tys::*;

use std::collections::HashMap;
use uuid::Uuid;

type Metadata<'a> = (
    (
        &'a stypes::Ident,
        &'a (Option<FieldsGetter>, Option<LazyFieldsTaskGetter>),
    ),
    (
        &'a stypes::Ident,
        &'a (Option<FieldsGetter>, Option<LazyFieldsTaskGetter>),
    ),
);

#[derive(Debug)]
pub enum LazyLoadingResult {
    Feilds(Vec<stypes::StaticFieldDesc>),
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
        // TODO: something about cancel safe
        select! {
            _ = self.meta.cancel.cancelled() => {
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
                Ok(LazyLoadingResult::Feilds(fields))
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
    //TODO: "hot" validators also here
    options: HashMap<Uuid, (Option<FieldsGetter>, Option<LazyFieldsTaskGetter>)>,
    sources: HashMap<Uuid, stypes::Ident>,
    parsers: HashMap<Uuid, stypes::Ident>,
}

impl Components {
    pub fn register(
        &mut self,
        ident: &stypes::Ident,
        static_fields_handle: Option<FieldsGetter>,
        lazy_fields_handle: Option<LazyFieldsTaskGetter>,
    ) -> Result<(), stypes::NativeError> {
        if self.options.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.options
            .insert(ident.uuid, (static_fields_handle, lazy_fields_handle));
        Ok(())
    }

    /// Register source metadata and set options getter
    pub fn register_source(
        &mut self,
        ident: &stypes::Ident,
        static_fields_handle: Option<FieldsGetter>,
        lazy_fields_handle: Option<LazyFieldsTaskGetter>,
    ) -> Result<(), stypes::NativeError> {
        self.register(ident, static_fields_handle, lazy_fields_handle)?;
        self.sources.insert(ident.uuid, ident.to_owned());
        Ok(())
    }

    /// Register parser metadata and set options getter
    pub fn register_parser(
        &mut self,
        ident: &stypes::Ident,
        static_fields_handle: Option<FieldsGetter>,
        lazy_fields_handle: Option<LazyFieldsTaskGetter>,
    ) -> Result<(), stypes::NativeError> {
        self.register(ident, static_fields_handle, lazy_fields_handle)?;
        self.parsers.insert(ident.uuid, ident.to_owned());
        Ok(())
    }

    pub fn get_sources(
        &self,
        _source_origin: stypes::SourceOrigin,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        // TODO: "ask" source based on origin
        Ok(self.sources.values().cloned().collect())
    }

    pub fn get_parsers(
        &self,
        _source_origin: stypes::SourceOrigin,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        // TODO: "ask" parser based on origin
        Ok(self.parsers.values().cloned().collect())
    }

    pub fn get_options(
        &self,
        source_origin: stypes::SourceOrigin,
        source: Uuid,
        parser: Uuid,
    ) -> Result<(Options, Options), stypes::NativeError> {
        let (
            (source_ident, (source_static, source_lazy)),
            (parser_ident, (parser_static, parser_lazy)),
        ) = self.get(&source, &parser)?;
        let source_fields = source_static
            .map(|getter| getter(&source_origin))
            .unwrap_or(Ok(Vec::new()))?;
        let parser_fields = parser_static
            .map(|getter| getter(&source_origin))
            .unwrap_or(Ok(Vec::new()))?;
        let mut source_options = Options::new(source_fields);
        let mut parser_options = Options::new(parser_fields);
        // Check do we have some lazy settings
        if let (Some(getter), true) = (source_lazy, source_options.has_lazy()) {
            let tk = CancellationToken::new();
            source_options.set_lazy(source_ident.clone(), getter(&source_origin, &tk), &tk);
        }
        if let (Some(getter), true) = (parser_lazy, parser_options.has_lazy()) {
            let tk = CancellationToken::new();
            parser_options.set_lazy(parser_ident.clone(), getter(&source_origin, &tk), &tk);
        }
        Ok((source_options, parser_options))
    }

    fn get<'a>(
        &'a self,
        source: &Uuid,
        parser: &Uuid,
    ) -> Result<Metadata<'a>, stypes::NativeError> {
        let source_ident = self.sources.get(source).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Source {} not found", source)),
        })?;
        let source_getter = self.options.get(source).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!(
                "Source options of {} ({}) not found",
                source_ident.name, source
            )),
        })?;
        let parser_ident = self.parsers.get(parser).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Parser {} not found", parser)),
        })?;
        let parser_getter = self.options.get(parser).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!(
                "Parser options of {} ({}) not found",
                parser_ident.name, parser
            )),
        })?;
        Ok(((source_ident, source_getter), (parser_ident, parser_getter)))
    }
}
