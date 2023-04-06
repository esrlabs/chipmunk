use crossbeam_channel as cc;
use serde::{Deserialize, Serialize};

#[allow(clippy::upper_case_acronyms)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
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

#[derive(Debug)]
pub enum ComputationResult<T> {
    Item(T),
    Stopped,
}

impl<T> ComputationResult<T> {
    pub fn into_option(self) -> Option<T> {
        match self {
            Self::Item(i) => Some(i),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Progress {
    Ticks(Ticks),
    Notification(Notification),
    Stopped,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Ticks {
    pub count: u64,
    pub state: Option<String>,
    pub total: Option<u64>,
}

impl Ticks {
    pub fn done(&self) -> bool {
        match self.total {
            Some(total) => self.count == total,
            None => false,
        }
    }

    pub fn new() -> Self {
        Ticks {
            count: 0,
            state: None,
            total: None,
        }
    }
}

impl Progress {
    pub fn ticks(count: u64, total: Option<u64>, state: Option<String>) -> Self {
        Self::Ticks(Ticks {
            count,
            total,
            state,
        })
    }
}

pub type IndexingResults<T> = std::result::Result<IndexingProgress<T>, Notification>;

#[derive(Debug)]
pub enum IndexingProgress<T> {
    /// GotItem called once per operation. It reflects results of operation, but
    /// not a progress
    GotItem {
        item: T,
    },
    /// Progress indicates how many ticks of the total amount have been processed
    /// the first number indicates the actual amount, the second the presumed total
    Progress {
        ticks: (u64, u64),
    },
    Stopped,
    Finished,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Notification {
    pub severity: Severity,
    pub content: String,
    pub line: Option<usize>,
}

pub struct ProgressReporter<T> {
    update_channel: cc::Sender<std::result::Result<IndexingProgress<T>, Notification>>,
    processed_bytes: u64,
    progress_percentage: u64,
    total: u64,
}

impl<T> ProgressReporter<T> {
    pub fn new(
        total: u64,
        update_channel: cc::Sender<std::result::Result<IndexingProgress<T>, Notification>>,
    ) -> ProgressReporter<T> {
        ProgressReporter {
            update_channel,
            processed_bytes: 0,
            progress_percentage: 0,
            total,
        }
    }
    pub fn make_progress(&mut self, consumed: usize) {
        self.processed_bytes += consumed as u64;
        let new_progress_percentage: u64 =
            (self.processed_bytes as f64 / self.total as f64 * 100.0).round() as u64;
        if new_progress_percentage != self.progress_percentage {
            self.progress_percentage = new_progress_percentage;
            match self.update_channel.send(Ok(IndexingProgress::Progress {
                ticks: (self.processed_bytes, self.total),
            })) {
                Ok(()) => (),
                Err(e) => warn!("could not send: {}", e),
            }
        }
    }
}
