//! Manages the state of the running jobs, keeping track on all their spawned tasks, providing
//! method to gracefully close them within a timeout and keeping info if the task should fail fast.

use std::{sync::OnceLock, time::Duration};

use tokio::time::timeout;
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use crate::tracker::get_tracker;

/// Duration to wait for jobs when cancellation is invoked.
pub const TIMEOUT_DURATION: Duration = Duration::from_secs(2);

/// Duration to wait after starting the shutdown process, to force the program to exit if it's
/// still active after the given has passed.
pub const FORCE_EXIT_DURATION: Duration = Duration::from_secs(3);

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
    is_release_build: bool,
}

impl JobsState {
    fn new(fail_fast: bool, is_app_release: bool) -> Self {
        Self {
            cancellation_token: CancellationToken::new(),
            task_tracker: TaskTracker::new(),
            fail_fast,
            is_release_build: is_app_release,
        }
    }

    /// Provides a reference for [`JobsState`] struct, initializing it with default values
    /// if not initializing before.
    pub fn get() -> &'static JobsState {
        JOBS_STATE.get_or_init(|| JobsState::new(false, false))
    }

    /// Initialize jobs state struct setting the fail fast option
    ///
    /// # Panics
    /// This function panics if [`JobsState`] already have been initialized or retrieved
    /// before the function call
    pub fn init(fail_fast: bool, is_app_release: bool) {
        JOBS_STATE
            .set(JobsState::new(fail_fast, is_app_release))
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

    /// Closes the tasks trackers and waits for spawned jobs to exit gracefully within
    /// the [`TIMEOUT_DURATION`].
    ///
    /// # Note:
    ///
    /// This function will spawn another thread to close the program immediately if graceful
    /// shutdown has failed, which will wait for [`FORCE_EXIT_DURATION`] then forces the program
    /// to exit.
    pub async fn graceful_shutdown(&self) {
        self.task_tracker.close();

        if timeout(TIMEOUT_DURATION, self.task_tracker.wait())
            .await
            .is_err()
        {
            // If task_tracker fails to close here, then it could be a dead-lock or another
            // undefined behavior while closing the running commands.
            // In this case we wait on other OS thread for couple seconds then force everything
            // to shutdown.
            std::thread::spawn(|| {
                eprintln!();
                eprintln!("Graceful shutdown failed, trying to close the app...");
                std::thread::sleep(FORCE_EXIT_DURATION);
                // Exit the app with error signal
                eprintln!("Forcing the program to exit...");
                std::process::exit(1)
            });

            let tracker = get_tracker();
            tracker.print("Graceful shutdown timed out");
            tracker.print(format!(
                "Forcing close in {} seconds...",
                FORCE_EXIT_DURATION.as_secs()
            ));
        }
    }

    /// Gets if the processes should be cancelled once any task fails.
    /// This function will set the value of fail fast to false if it doesn't
    /// contain a value before.
    pub fn fail_fast(&self) -> bool {
        self.fail_fast
    }

    /// Determines whether jobs are currently running to build and bundle a release of Chipmunk.
    pub fn is_release_build(&self) -> bool {
        self.is_release_build
    }
}
