use tokio::sync::oneshot;

// SourceDataExchange - Sde
// Channel allows to send message into ByteSource implementaion in run-time
pub type SdeMsg = (
    stypes::SdeRequest,
    oneshot::Sender<Result<stypes::SdeResponse, String>>,
);
