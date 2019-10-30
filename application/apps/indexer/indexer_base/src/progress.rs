use serde::Serialize;

#[derive(Serialize, Debug)]
pub enum Severity {
    WARNING,
    ERROR,
}

#[derive(Debug)]
pub enum IndexingProgress<T> {
    GotItem { item: T },
    Progress { ticks: (usize, usize) },
    Stopped,
    Notification { severity: Severity, content: String },
    Finished,
}

pub enum IndexingResult<T> {
    Completed(T),
    Interrupted(T),
}
