use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use log::debug;
use std::path::PathBuf;

pub async fn handle(
    operation_api: &OperationAPI,
    state: SessionStateAPI,
    out_path: PathBuf,
    ranges: Vec<std::ops::RangeInclusive<u64>>,
) -> OperationResult<bool> {
    debug!("RUST: Export operation is requested");
    Ok(Some(
        state
            .export_session(out_path, ranges, operation_api.cancellation_token())
            .await?,
    ))
}
