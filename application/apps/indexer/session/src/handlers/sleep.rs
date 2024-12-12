use crate::operations::{OperationAPI, OperationResult};
use tokio::{select, time};

pub async fn handle(
    operation_api: &OperationAPI,
    ms: u64,
    ignore_cancellation: bool,
) -> OperationResult<stypes::SleepResult> {
    if ignore_cancellation {
        time::sleep(time::Duration::from_millis(ms)).await;
        Ok(Some(stypes::SleepResult { sleep_well: true }))
    } else {
        let canceler = operation_api.cancellation_token();
        select! {
            _ = async move {
                time::sleep(time::Duration::from_millis(ms)).await;
            } => {
                Ok(Some( stypes::SleepResult { sleep_well: true }))
            },
            _ = canceler.cancelled() => {
                Ok(Some( stypes::SleepResult { sleep_well: false }))
            }
        }
    }
}
