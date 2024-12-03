/// Provides additional information to be rendered in the log view.
pub struct RenderOptions {
    /// List of strings representing the header names to be rendered at the top of log messages.
    /// This list allows users to specify which columns are visible as well.
    ///
    /// # Note
    /// Headers should be provided only if the log messages have multiple columns, and their
    /// count must match the count of the columns of the log message as well.
    pub headers: Option<Vec<String>>,
}
