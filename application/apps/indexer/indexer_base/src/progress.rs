use serde::Serialize;

#[derive(Serialize, Debug, PartialEq)]
pub enum Severity {
    WARNING,
    ERROR,
}
impl Severity {
    pub fn as_str(&self) -> &str {
        match self {
            Severity::WARNING => "WARNING",
            Severity::ERROR => "ERROR",
        }
    }
}

pub type IndexingResults<T> = std::result::Result<IndexingProgress<T>, Notification>;

#[derive(Debug)]
pub enum IndexingProgress<T> {
    GotItem { item: T },
    Progress { ticks: (usize, usize) },
    Stopped,
    Finished,
}
pub struct Notification {
    pub severity: Severity,
    pub content: String,
    pub line: Option<usize>,
}
