use tokio::sync::{
    mpsc::{UnboundedReceiver, UnboundedSender},
    oneshot,
};

// SourceDataExchange - Sde
// Channel allows to send message into ByteSource implementaion in run-time
pub type SdeMsg = (
    stypes::SdeRequest,
    oneshot::Sender<Result<stypes::SdeResponse, String>>,
);

pub type SdeSender = UnboundedSender<SdeMsg>;
pub type SdeReceiver = UnboundedReceiver<SdeMsg>;
