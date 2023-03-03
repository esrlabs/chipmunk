use crate::{events::ComputationError, unbound::signal::Signal};
use tokio::{
    select,
    time::{sleep, Duration},
};

pub async fn handler(
    custom_arg_a: i64,
    custom_arg_b: i64,
    signal: Signal,
) -> Result<i64, ComputationError> {
    select! {
        _ = signal.cancelled() => {
            Ok(0)
        }
        _ = sleep(Duration::from_millis(3000)) => {
            Ok(custom_arg_a + custom_arg_b)
        }
    }
}
