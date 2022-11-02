use crate::{events::NativeError, state::SessionStateAPI};

pub async fn get_source_id(state: &SessionStateAPI, uuid: &str) -> Result<u8, NativeError> {
    state.add_source(uuid).await
}
