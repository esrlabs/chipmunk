use super::CommandOutcome;
use crate::{error::ComputationError, unbound::signal::Signal};
use tokio::time;

// This command is used for testing/debug goals only. It should ignore signal to ignore
// cancellation.
pub async fn sleep(ms: u64, _signal: Signal) -> Result<CommandOutcome<()>, ComputationError> {
    let _ = time::sleep(time::Duration::from_millis(ms)).await;
    Ok(CommandOutcome::Finished(()))
}
