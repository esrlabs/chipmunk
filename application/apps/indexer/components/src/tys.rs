use crate::*;
use stypes::NativeError;
use tokio_util::sync::CancellationToken;

pub type FieldsResult = Result<Vec<stypes::FieldDesc>, stypes::NativeError>;

pub type FieldsGetter = fn(&stypes::SourceOrigin) -> FieldsResult;

pub type StaticFieldsResult = Result<Vec<stypes::StaticFieldDesc>, stypes::NativeError>;

pub type LazyFieldsGetter = fn(
    &stypes::SourceOrigin,
    oneshot::Sender<StaticFieldsResult>,
    &CancellationToken,
) -> Result<(), NativeError>;

pub trait Component {
    /// Returns an identificator
    fn ident() -> stypes::Ident;

    /// Registration
    fn register(components: &mut Components) -> Result<(), stypes::NativeError>;
}
