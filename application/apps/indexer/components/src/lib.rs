mod tys;

use tokio::{select, sync::oneshot};
use tokio_util::sync::CancellationToken;
pub use tys::*;

use std::collections::HashMap;
use uuid::Uuid;

type Metadata<'a> = (
    (
        &'a stypes::Ident,
        &'a (Option<FieldsGetter>, Option<LazyFieldsGetter>),
    ),
    (
        &'a stypes::Ident,
        &'a (Option<FieldsGetter>, Option<LazyFieldsGetter>),
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
    rx: Option<oneshot::Receiver<Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>>>,
}

impl LazyLoadingTask {
    pub fn new(
        ident: stypes::Ident,
        rx: oneshot::Receiver<Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>>,
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
            rx: Some(rx),
        }
    }

    pub fn get_meta(&self) -> LazyLoadingTaskMeta {
        self.meta.clone()
    }

    pub async fn wait(&mut self) -> Result<LazyLoadingResult, stypes::NativeError> {
        let Some(rx) = self.rx.take() else {
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
            fields = rx => {
                let fields = fields.map_err(|_| stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::ChannelError,
                    message: Some(format!(
                        "Fail to get settings for {}",
                        self.meta.ident.name
                    )),
                })??;
                Ok(LazyLoadingResult::Feilds(fields))
            }
        }
    }
}

pub struct Options {
    pub source: Vec<stypes::FieldDesc>,
    pub parser: Vec<stypes::FieldDesc>,
    pub lazy_source: Option<LazyLoadingTask>,
    pub lazy_parser: Option<LazyLoadingTask>,
}

impl Options {
    pub fn with_static(source: Vec<stypes::FieldDesc>, parser: Vec<stypes::FieldDesc>) -> Self {
        Self {
            source,
            parser,
            lazy_source: None,
            lazy_parser: None,
        }
    }
    pub fn set_source_lazy_task(
        &mut self,
        ident: stypes::Ident,
        rx: oneshot::Receiver<Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>>,
        cancel: &CancellationToken,
    ) {
        self.lazy_source = Some(LazyLoadingTask::new(
            ident,
            rx,
            cancel,
            self.source_lazy_uuids(),
        ));
    }
    pub fn set_parser_lazy_task(
        &mut self,
        ident: stypes::Ident,
        rx: oneshot::Receiver<Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>>,
        cancel: &CancellationToken,
    ) {
        self.lazy_parser = Some(LazyLoadingTask::new(
            ident,
            rx,
            cancel,
            self.parser_lazy_uuids(),
        ));
    }
    pub fn source_has_lazy(&self) -> bool {
        self.source
            .iter()
            .any(|f| matches!(f, stypes::FieldDesc::Lazy(..)))
    }
    pub fn parser_has_lazy(&self) -> bool {
        self.parser
            .iter()
            .any(|f| matches!(f, stypes::FieldDesc::Lazy(..)))
    }
    pub fn source_lazy_uuids(&self) -> Vec<String> {
        self.source
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
    pub fn parser_lazy_uuids(&self) -> Vec<String> {
        self.parser
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
    options: HashMap<Uuid, (Option<FieldsGetter>, Option<LazyFieldsGetter>)>,
    sources: HashMap<Uuid, stypes::Ident>,
    parsers: HashMap<Uuid, stypes::Ident>,
}

impl Components {
    pub fn register(
        &mut self,
        ident: &stypes::Ident,
        static_fields_handle: Option<FieldsGetter>,
        lazy_fields_handle: Option<LazyFieldsGetter>,
    ) -> Result<(), stypes::NativeError> {
        if self.options.contains_key(&ident.uuid) || self.sources.contains_key(&ident.uuid) {
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
        lazy_fields_handle: Option<LazyFieldsGetter>,
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
        lazy_fields_handle: Option<LazyFieldsGetter>,
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
    ) -> Result<Options, stypes::NativeError> {
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
        let mut options = Options::with_static(source_fields, parser_fields);
        // Check do we have some lazy settings
        if let (Some(getter), true) = (source_lazy, options.source_has_lazy()) {
            let (tx, rx) = oneshot::channel();
            let tk = CancellationToken::new();
            getter(&source_origin, tx, &tk)?;
            options.set_source_lazy_task(source_ident.clone(), rx, &tk);
        }
        if let (Some(getter), true) = (parser_lazy, options.source_has_lazy()) {
            let (tx, rx) = oneshot::channel();
            let tk = CancellationToken::new();
            getter(&source_origin, tx, &tk)?;
            options.set_parser_lazy_task(parser_ident.clone(), rx, &tk);
        }
        Ok(options)
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
