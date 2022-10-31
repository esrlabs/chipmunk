use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use sources::factory::ParserType;
use std::path::PathBuf;

#[allow(clippy::type_complexity)]
pub async fn listen<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    files: &[(String, PathBuf)],
    parser: &'a ParserType,
) -> OperationResult<()> {
    for file in files.iter() {
        let (uuid, filename) = file;
        let source_id = observing::sources::get_source_id(&state, uuid).await?;
        super::run(
            operation_api.clone(),
            state.clone(),
            observing::sources::file(parser, filename)?,
            source_id,
            parser,
            None,
            None,
        )
        .await?;
    }
    Ok(Some(()))
}
