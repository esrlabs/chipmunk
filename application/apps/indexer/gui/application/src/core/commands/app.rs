/// Represents general application commands to be sent from UI to State.
#[derive(Debug, Clone)]
pub enum AppCommand {
    OpenFile,
    Close,
}
