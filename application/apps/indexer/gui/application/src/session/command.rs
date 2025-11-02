use processor::{grabber::LineRange, search::filter::SearchFilter};

/// Represents session specific commands to be sent from UI to State.
#[derive(Debug, Clone)]
pub enum SessionCommand {
    GrabLines(LineRange),
    ApplySearchFilter(Vec<SearchFilter>),
    DropSearch,
    CloseSession,
}
