use thiserror::Error;

use crate::core::events::AppEvent;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Error while sending app event to UI")]
    SendEvent(AppEvent),
}
