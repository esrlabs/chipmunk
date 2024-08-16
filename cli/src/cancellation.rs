use std::{sync::OnceLock, time::Duration};

use tokio::time::timeout;
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use crate::tracker::get_tracker;

/// Duration to wait for jobs when cancellation is invoked.
pub const TIMEOUT_DURATION: Duration = Duration::from_secs(2);

/// Returns a reference to the shared [`CancellationToken`] across all the tasks in process
pub fn cancellation_token() -> &'static CancellationToken {
    static CANCELLATION_TOKEN: OnceLock<CancellationToken> = OnceLock::new();

    CANCELLATION_TOKEN.get_or_init(CancellationToken::default)
}

/// Returns a reference to the [`TaskTracker`] that will be used to spawn all
/// the task across the process.
pub fn task_tracker() -> &'static TaskTracker {
    static TASK_TRACKER: OnceLock<TaskTracker> = OnceLock::new();

    TASK_TRACKER.get_or_init(TaskTracker::new)
}

/// Closes the tasks trackers and waits for spawned jobs to exit gracefully within the [`TIMEOUT_DURATION`]
pub async fn graceful_shutdown() {
    let task_tracker = task_tracker();
    task_tracker.close();

    if timeout(TIMEOUT_DURATION, task_tracker.wait())
        .await
        .is_err()
    {
        let tracker = get_tracker();
        tracker.print("Graceful shutdown timed out");
    }
}
