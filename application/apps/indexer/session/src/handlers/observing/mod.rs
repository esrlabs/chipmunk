use std::path::PathBuf;

use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use definitions::{ByteSource, LogRecordWriter, MessageStreamItem, Parser};
use log::trace;
use parsers::{
    dlt::{fmt::FormatOptions, DltParser},
    someip::{FibexMetadata as FibexSomeipMetadata, SomeipParser},
    text::StringTokenizer,
};
use plugins_host::PluginsParser;
use sources::{
    producer::MessageProducer,
    sde::{SdeMsg, SdeReceiver},
};
use tokio::{
    select,
    sync::mpsc::Receiver,
    time::{timeout, Duration},
};

enum Next {
    Parsed(usize, MessageStreamItem),
    Timeout,
    Waiting,
    Sde(SdeMsg),
}

pub mod concat;
pub mod file;
pub mod stream;

pub const FLUSH_TIMEOUT_IN_MS: u128 = 5000;

pub async fn run_source<S: ByteSource, W: LogRecordWriter>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: &stypes::ParserType,
    writer: W,

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
        writer,
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
async fn run_source_intern<S: ByteSource, W: LogRecordWriter>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: &stypes::ParserType,
    writer: W,
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
            let producer = MessageProducer::new(parser, source, writer);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::SomeIp(settings) => {
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            let producer = MessageProducer::new(someip_parser, source, writer);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::Text(()) => {
            let producer = MessageProducer::new(StringTokenizer {}, source, writer);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::Dlt(settings) => {
            let fmt_options = Some(FormatOptions::from(settings.tz.as_ref()));
            let someip_metadata = settings.fibex_file_paths.as_ref().and_then(|paths| {
                FibexSomeipMetadata::from_fibex_files(paths.iter().map(PathBuf::from).collect())
            });
            let dlt_parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                // TODO: find a way to avoid clonning of MD
                settings.fibex_metadata.as_ref().map(|md| md.clone()),
                fmt_options,
                someip_metadata,
                settings.with_storage_header,
            );
            let producer = MessageProducer::new(dlt_parser, source, writer);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
    }
}

pub async fn run_producer<P: Parser, S: ByteSource, W: LogRecordWriter>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u16,
    mut producer: MessageProducer<P, S, W>,
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
                Ok(result) => {
                    if let Some((consumed, results)) = result {
                                            println!(">>>>>>>>>>>>>>>>>> UPPER LOOP: 0000");
                        Some(Next::Parsed(consumed, results))
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
            Next::Parsed(_consumed, results) => match results {
                MessageStreamItem::Parsed(_results) => {
                    //Just continue
                    println!(">>>>>>>>>>>>>>>>>> UPPER LOOP: 0001");
                }
                MessageStreamItem::Done => {
                    println!(">>>>>>>>>>>>>>>>>> UPPER LOOP: 0002");
                    trace!("observe, message stream is done");
                    state.flush_session_file().await?;
                    state.file_read().await?;
                }
                MessageStreamItem::Skipped => {
                    println!(">>>>>>>>>>>>>>>>>> UPPER LOOP: 0003");
                    trace!("observe: skipped a message");
                }
            },
            Next::Timeout => {
                println!(">>>>>>>>>>>>>>>>>> UPPER LOOP: 0004");

                if !state.is_closing() {
                    state.flush_session_file().await?;
                }
            }
            Next::Waiting => {
                println!(">>>>>>>>>>>>>>>>>> UPPER LOOP: 0005");
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
