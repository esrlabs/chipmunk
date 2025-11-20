use stypes::GrabbedElement;

#[derive(Debug, Default)]
pub struct LogsState {
    pub logs_count: u64,
    /// The stream position of the log which the main logs table
    /// should scroll into.
    pub scroll_main_row: Option<u64>,
    /// Currently selected log.
    pub selected_log: Option<GrabbedElement>,
}
