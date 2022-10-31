use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use sources::{
    factory::{ParserType, Transport},
    producer::SdeReceiver,
};

pub async fn listen<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    transport: &Transport,
    parser: &'a ParserType,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let source_id = observing::sources::get_source_id(&state, uuid).await?;
    observing::listeners::run(
        operation_api,
        state,
        observing::sources::stream(transport).await?,
        source_id,
        parser,
        rx_sde,
        None,
    )
    .await
}
