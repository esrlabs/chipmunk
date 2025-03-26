use components::LazyLoadingResult;
use stypes::{Ident, NativeError, SourceOrigin};
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Debug)]
pub enum Api {
    Shutdown(oneshot::Sender<()>),
    LazyTaskComplite(Uuid, Result<LazyLoadingResult, NativeError>),
    CancelLoading(Vec<String>),
    GetOptions {
        parser: Uuid,
        source: Uuid,
        origin: SourceOrigin,
        tx: oneshot::Sender<Result<stypes::ComponentsOptions, NativeError>>,
    },
    GetSources(
        SourceOrigin,
        oneshot::Sender<Result<Vec<Ident>, NativeError>>,
    ),
    GetParsers(
        SourceOrigin,
        oneshot::Sender<Result<Vec<Ident>, NativeError>>,
    ),
}
