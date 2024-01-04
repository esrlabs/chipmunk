use crate::operations::{OperationAPI, OperationResult};
use serde::{Deserialize, Serialize};
use tokio::{select, time};

#[derive(Debug, Serialize, Deserialize)]
pub struct SleepResult {
    pub sleep_well: bool,
}

pub async fn handle(
    operation_api: &OperationAPI,
    ms: u64,
    ignore_cancellation: bool,
) -> OperationResult<SleepResult> {
    if ignore_cancellation {
        time::sleep(time::Duration::from_millis(ms)).await;
        Ok(Some(SleepResult { sleep_well: true }))
    } else {
        let canceler = operation_api.cancellation_token();
        select! {
            _ = async move {
                time::sleep(time::Duration::from_millis(ms)).await;
            } => {
                Ok(Some( SleepResult { sleep_well: true }))
            },
            _ = canceler.cancelled() => {
                Ok(Some( SleepResult { sleep_well: false }))
            }
        }
    }
}
