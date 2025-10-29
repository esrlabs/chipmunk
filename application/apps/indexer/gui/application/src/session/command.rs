use processor::grabber::LineRange;

/// Represents session specific commands to be sent from UI to State.
#[derive(Debug, Clone)]
pub enum SessionCommand {
    GrabLines(LineRange),
    CloseSession,
}
