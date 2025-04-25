use std::path::{Path, PathBuf};

use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};

use plugins_host::PluginsProducer;

use stypes::PluginConfigItem;
use tokio::{
    join,
    sync::mpsc::{channel, Receiver},
};

/// Function tries to replicates running observing sessions using producer plugins.
/// This is a temporary solution until producer plugins are fully integrated.
pub async fn run_producer_plugin(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    plugin_path: PathBuf,
    filename: &Path,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;

    // TODO AAZ: Check if tail is needed.
    let (tx_tail, rx_tail) = channel(1);

    let (_, listening) = join!(
        tail::track(filename, tx_tail, operation_api.cancellation_token()),
        run_producer_plugin_intern(
            operation_api,
            state,
            source_id,
            plugin_path,
            filename,
            Some(rx_tail)
        )
    );
    listening
}

pub async fn run_producer_plugin_intern(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u16,
    plugin_path: PathBuf,
    filename: &Path,
    rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    let cancel = operation_api.cancellation_token();

    let path_config = PluginConfigItem::new(
        "file_path",
        stypes::PluginConfigValue::Files(vec![filename.to_path_buf()]),
    );

    let producer =
        PluginsProducer::initialize(&plugin_path, &Default::default(), vec![path_config])
            .await
            .expect("Error while initializing plugin producer");

    let operation_result =
        super::run_producer(operation_api, state, source_id, producer, rx_tail, None).await;

    if operation_result.is_err() && !cancel.is_cancelled() {
        cancel.cancel();
    }

    operation_result
}
