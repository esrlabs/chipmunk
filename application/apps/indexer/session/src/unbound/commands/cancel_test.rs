use crate::{
    events::ComputationError,
    unbound::{commands::CommandOutcome, signal::Signal},
};
use tokio::{
    select,
    time::{sleep, Duration},
};

pub async fn cancel_test(
    custom_arg_a: i64,
    custom_arg_b: i64,
    signal: Signal,
) -> Result<CommandOutcome<i64>, ComputationError> {
    Ok(select! {
        _ = signal.cancelled() => {
            CommandOutcome::Cancelled
        }
        _ = sleep(Duration::from_millis(500)) => {
            CommandOutcome::Finished(custom_arg_a + custom_arg_b)
        }
    })
}
