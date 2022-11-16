use super::export_raw;
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
    debug!("RUST: ExportSearchRaw operation is requested");
    let mapped = state.map_search_ranges(ranges.clone()).await?;
    export_raw::handle(operation_api, state, out_path, mapped).await
}
