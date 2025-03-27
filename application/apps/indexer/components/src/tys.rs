use std::{future::Future, pin::Pin};

use crate::*;
use tokio_util::sync::CancellationToken;

pub type FieldsResult = Result<Vec<stypes::FieldDesc>, stypes::NativeError>;

pub type FieldsGetter = fn(&stypes::SourceOrigin) -> FieldsResult;

pub type StaticFieldsResult = Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>;
pub type LazyFieldsTask = Pin<Box<dyn Future<Output = StaticFieldsResult> + Send>>;
pub type LazyFieldsTaskGetter = fn(&stypes::SourceOrigin, &CancellationToken) -> LazyFieldsTask;

pub trait Component {
    /// Returns an identificator
    fn ident() -> stypes::Ident;

    /// Registration
    fn register(components: &mut Components) -> Result<(), stypes::NativeError>;
}
