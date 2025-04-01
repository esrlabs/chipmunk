use components::{LazyLoadingResult, LazyLoadingTaskMeta};
use stypes::{Ident, NativeError, SourceOrigin};
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Debug)]
pub enum Api {
    Shutdown(oneshot::Sender<()>),
    LazyTaskComplite(
        Uuid,
        LazyLoadingTaskMeta,
        Result<LazyLoadingResult, NativeError>,
    ),
    CancelLoading(Vec<String>),
    GetOptions {
        origin: SourceOrigin,
        targets: Vec<Uuid>,
        tx: oneshot::Sender<Result<stypes::ComponentsOptionsList, NativeError>>,
    },
    GetComponents(
        SourceOrigin,
        stypes::ComponentType,
        oneshot::Sender<Result<Vec<Ident>, NativeError>>,
    ),
}
