use crate::unbound::signal::Signal;
use tokio::{
    select,
    time::{sleep, Duration},
};

pub async fn cancel_test(
    custom_arg_a: i64,
    custom_arg_b: i64,
    signal: Signal,
) -> Result<stypes::CommandOutcome<i64>, stypes::ComputationError> {
    Ok(select! {
        _ = signal.cancelled() => {
            stypes::CommandOutcome::Cancelled
        }
        _ = sleep(Duration::from_millis(500)) => {
            stypes::CommandOutcome::Finished(custom_arg_a + custom_arg_b)
        }
    })
}
