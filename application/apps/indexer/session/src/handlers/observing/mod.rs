use std::path::PathBuf;

use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use log::trace;
use parsers::{
    dlt::{fmt::FormatOptions, DltParser},
    someip::{FibexMetadata as FibexSomeipMetadata, SomeipParser},
    text::StringTokenizer,
    LogMessage, MessageStreamItem, ParseYield,
};
use plugins_host::PluginsParser;
use sources::{
    producer::{CombinedProducer, MessageProducer},
    sde::{SdeMsg, SdeReceiver},
    ByteSource,
};
use tokio::{
    select,
    sync::mpsc::Receiver,
    time::{timeout, Duration},
};

enum Next<'a, T: LogMessage> {
    Items(&'a mut Vec<(usize, MessageStreamItem<T>)>),
    Timeout,
    Waiting,
    Sde(SdeMsg),
}

pub mod concat;
pub mod file;
pub mod plugin;
pub mod stream;

pub const FLUSH_TIMEOUT_IN_MS: u128 = 500;

pub async fn run_source<S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: stypes::ParserType,
    rx_sde: Option<SdeReceiver>,
    rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    let cancel = operation_api.cancellation_token();

    // Actual function is wrapped here in order to react on errors and cancel other tasks
    // running concurrently.
    let operation_result = run_source_intern(
        operation_api,
        state,
        source,
        source_id,
        parser,
        rx_sde,
        rx_tail,
    )
    .await;

    if operation_result.is_err() && !cancel.is_cancelled() {
        cancel.cancel();
    }

    operation_result
}

/// Contains all implementation details for running the source and the producer in the session
async fn run_source_intern<S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: stypes::ParserType,
    rx_sde: Option<SdeReceiver>,
    rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    match parser {
        stypes::ParserType::Plugin(settings) => {
            let parser = PluginsParser::initialize(
                &settings.plugin_path,
                &settings.general_settings,
                settings.plugin_configs.clone(),
            )
            .await?;
            let producer = CombinedProducer::new(parser, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::SomeIp(settings) => {
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            let producer = CombinedProducer::new(someip_parser, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::Text(()) => {
            let producer = CombinedProducer::new(StringTokenizer {}, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::Dlt(settings) => {
            let fmt_options = Some(FormatOptions::from(settings.tz.as_ref()));
            let someip_metadata = settings.fibex_file_paths.as_ref().and_then(|paths| {
                FibexSomeipMetadata::from_fibex_files(paths.iter().map(PathBuf::from).collect())
            });
            let dlt_parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata,
                fmt_options,
                someip_metadata,
                settings.with_storage_header,
            );
            let producer = CombinedProducer::new(dlt_parser, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
    }
}

async fn run_producer<T: LogMessage + 'static, P: MessageProducer<T>>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u16,
    mut producer: P,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
    mut rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    use log::debug;
    state.set_session_file(None).await?;
    operation_api.processing();
    let cancel = operation_api.cancellation_token();
    let cancel_on_tail = cancel.clone();
    while let Some(next) = select! {
        next_from_stream = async {
            match timeout(Duration::from_millis(FLUSH_TIMEOUT_IN_MS as u64), producer.read_next_segment()).await {
                Ok(items) => {
                    if let Some(items) = items {
                        Some(Next::Items(items))
                    } else {
                        Some(Next::Waiting)
                    }
                },
                Err(_) => Some(Next::Timeout),
            }
        } => next_from_stream,
        Some(sde_msg) = async {
            if let Some(rx_sde) = rx_sde.as_mut() {
                rx_sde.recv().await
            } else {
                None
            }
        } => Some(Next::Sde(sde_msg)),

        _ = cancel.cancelled() => None,
    } {
        match next {
            Next::Items(items) => {
                // Iterating over references is more efficient than using `drain(..)`, even though
                // we clone the attachments below. With ownership, `mem_copy()` would still be called
                // to move the item into the attachment vector. Cloning avoids the overhead of
                // `drain(..)`, especially since `items` is cleared on each iteration anyway.
                for (_, item) in items {
                    match item {
                        MessageStreamItem::Item(ParseYield::Message(item)) => {
                            state
                                .write_session_file(source_id, format!("{item}\n"))
                                .await?;
                        }
                        MessageStreamItem::Item(ParseYield::MessageAndAttachment((
                            item,
                            attachment,
                        ))) => {
                            state
                                .write_session_file(source_id, format!("{item}\n"))
                                .await?;
                            state.add_attachment(attachment.to_owned())?;
                        }
                        MessageStreamItem::Item(ParseYield::Attachment(attachment)) => {
                            state.add_attachment(attachment.to_owned())?;
                        }
                        MessageStreamItem::Done => {
                            trace!("observe, message stream is done");
                            state.flush_session_file().await?;
                            state.file_read().await?;
                        }
                        // MessageStreamItem::FileRead => {
                        //     state.file_read().await?;
                        // }
                        MessageStreamItem::Skipped => {
                            trace!("observe: skipped a message");
                        }
                        MessageStreamItem::Incomplete => {
                            trace!("observe: incomplete message");
                        }
                        MessageStreamItem::Empty => {
                            trace!("observe: empty message");
                        }
                    }
                }
            }
            Next::Timeout => {
                if !state.is_closing() {
                    state.flush_session_file().await?;
                }
            }
            Next::Waiting => {
                if let Some(mut rx_tail) = rx_tail.take() {
                    if select! {
                        next_from_stream = rx_tail.recv() => {
                            if let Some(result) = next_from_stream {
                                result.is_err()
                            } else {
                                true
                            }
                        },
                        _ = cancel_on_tail.cancelled() => true,
                    } {
                        break;
                    }
                } else {
                    break;
                }
            }
            Next::Sde((msg, tx_response)) => {
                let sde_res = producer.sde_income(msg).await.map_err(|e| e.to_string());
                if tx_response.send(sde_res).is_err() {
                    log::warn!("Fail to send back message from source");
                }
            }
        }
    }
    debug!("listen done");
    Ok(None)
}
