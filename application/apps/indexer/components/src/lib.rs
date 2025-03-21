mod tys;

use log::error;
use tokio::{sync::oneshot, task};
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

pub struct LazyLoadingTask {
    ident: stypes::Ident,
    rx: oneshot::Receiver<Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>>,
    cancel: CancellationToken,
}

impl LazyLoadingTask {
    pub fn new(
        ident: stypes::Ident,
        rx: oneshot::Receiver<Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>>,
        cancel: &CancellationToken,
    ) -> Self {
        Self {
            ident,
            rx,
            cancel: cancel.clone(),
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
            options.lazy_source = Some(LazyLoadingTask::new(source_ident.clone(), rx, &tk));
        }
        if let (Some(getter), true) = (parser_lazy, options.source_has_lazy()) {
            let (tx, rx) = oneshot::channel();
            let tk = CancellationToken::new();
            getter(&source_origin, tx, &tk)?;
            options.lazy_parser = Some(LazyLoadingTask::new(parser_ident.clone(), rx, &tk));
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
