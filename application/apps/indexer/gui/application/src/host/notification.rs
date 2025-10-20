use crate::host::error::HostError;

#[derive(Debug)]
pub enum AppNotification {
    HostError(HostError),
    Info(String),
}
