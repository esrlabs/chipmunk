use thiserror::Error;

use crate::host::event::HostEvent;

#[derive(Debug, Error)]
pub enum HostError {
    #[error("Error while sending app event to UI")]
    SendEvent(HostEvent),
}
