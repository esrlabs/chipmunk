//! Manages the state of the running jobs, keeping track on all their spawned tasks, providing
//! method to gracefully close them within a timeout and keeping info if the task should fail fast.

use std::{sync::OnceLock, time::Duration};

use tokio::time::timeout;
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use crate::tracker::get_tracker;

/// Duration to wait for jobs when cancellation is invoked.
pub const TIMEOUT_DURATION: Duration = Duration::from_secs(2);

/// [`JobsState`] singleton
static JOBS_STATE: OnceLock<JobsState> = OnceLock::new();

/// Manages the state of the running jobs, keeping track on all their spawned tasks, providing
/// method to gracefully close them within a timeout.
/// It keeps the info in task should fail fast too.
#[derive(Debug)]
pub struct JobsState {
    cancellation_token: CancellationToken,
    task_tracker: TaskTracker,
    fail_fast: bool,
}

impl JobsState {
    fn new(fail_fast: bool) -> Self {
        Self {
            cancellation_token: CancellationToken::new(),
            task_tracker: TaskTracker::new(),
            fail_fast,
        }
    }

    /// Provides a reference for [`JobsState`] struct, initializing it with default values
    /// if not initializing before.
    pub fn get() -> &'static JobsState {
        JOBS_STATE.get_or_init(|| JobsState::new(false))
    }

    /// Initialize jobs state struct setting the fail fast option
    ///
    /// # Panics
    /// This function panics if [`JobsState`] already have been initialized or retrieved
    /// before the function call
    pub fn init(fail_fast: bool) {
        JOBS_STATE
            .set(JobsState::new(fail_fast))
            .expect("Jobs state can't be initialized twice");
    }

    /// Returns a reference to the shared [`CancellationToken`] across all the tasks in process
    pub fn cancellation_token(&self) -> &CancellationToken {
        &self.cancellation_token
    }

    /// Returns a reference to the [`TaskTracker`] that will be used to spawn all
    /// the task across the process.
    pub fn task_tracker(&self) -> &TaskTracker {
        &self.task_tracker
    }

    /// Closes the tasks trackers and waits for spawned jobs to exit gracefully within the [`TIMEOUT_DURATION`]
    pub async fn graceful_shutdown(&self) {
        self.task_tracker.close();

        if timeout(TIMEOUT_DURATION, self.task_tracker.wait())
            .await
            .is_err()
        {
            let tracker = get_tracker();
            tracker.print("Graceful shutdown timed out");
        }
    }

    /// Gets if the processes should be cancelled once any task fails.
    /// This function will set the value of fail fast to false if it doesn't
    /// contain a value before.
    pub fn fail_fast(&self) -> bool {
        self.fail_fast
    }
}
