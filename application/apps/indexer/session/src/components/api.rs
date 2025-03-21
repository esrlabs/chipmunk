use stypes::NativeError;
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Debug)]
pub enum API {
    Shutdown(oneshot::Sender<()>),
    GetOptions {
        parser: Uuid,
        source: Uuid,
        origin: stypes::SourceOrigin,
        tx: oneshot::Sender<Result<(Vec<stypes::FieldDesc>, Vec<stypes::FieldDesc>), NativeError>>,
    },
}
