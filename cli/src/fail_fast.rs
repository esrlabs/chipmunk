//! Manages the state of fail fast option when development commands are running.

use std::sync::OnceLock;

static FAIL_FAST_STATE: OnceLock<bool> = OnceLock::new();

/// Sets the value for fail fast for jobs.
///
/// # Panics
/// This function panics if fail fast value already have been set or retrieved
/// before the function call
pub fn set_fail_fast(fail_fast: bool) {
    if FAIL_FAST_STATE.set(fail_fast).is_err() {
        panic!("Fail fast must be set once only");
    }
}

/// Gets if the processes should be cancelled once any task fails.
/// This function will set the value of fail fast to false if it doesn't
/// contain a value before.
pub fn fail_fast() -> bool {
    *FAIL_FAST_STATE.get_or_init(|| false)
}
