use serde::Serialize;
use crate::chunks::*;
use crossbeam_channel as cc;

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

pub struct ProgressReporter {
    update_channel: cc::Sender<ChunkResults>,
    processed_bytes: usize,
    progress_percentage: usize,
    total: usize,
}
impl ProgressReporter {
    pub fn new(total: usize, update_channel: cc::Sender<ChunkResults>) -> ProgressReporter {
        ProgressReporter {
            update_channel,
            processed_bytes: 0,
            progress_percentage: 0,
            total,
        }
    }
    pub fn make_progress(&mut self, consumed: usize) {
        self.processed_bytes += consumed;
        let new_progress_percentage: usize =
            (self.processed_bytes as f64 / self.total as f64 * 100.0).round() as usize;
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
