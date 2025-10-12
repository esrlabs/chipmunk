use std::path::PathBuf;

use crate::{
    handlers::observing::logs_writer::LogsWriter,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use parsers::{
    Parser,
    dlt::{DltParser, fmt::FormatOptions},
    someip::{FibexMetadata as FibexSomeipMetadata, SomeipParser},
    text::StringTokenizer,
};
use plugins_host::PluginsParser;
use processor::producer::{MessageProducer, ProduceError, ProduceSummary};
use sources::{
    ByteSource,
    sde::{SdeMsg, SdeReceiver},
};
use tokio::{
    select,
    sync::mpsc::Receiver,
    time::{Duration, timeout},
};

pub mod concat;
pub mod file;
mod logs_writer;
pub mod stream;

pub const FLUSH_TIMEOUT_IN_MS: u128 = 500;

/// Represents the possible steps while running the processing loop for a source.
/// This is for internal representation only.
enum Next {
    /// Items has been produced and needed to be sent.
    ItemsProduced,
    /// Producer is done. No loading or parsing is possible.
    ProducerDone,
    /// Flush timeout while waiting for next items has expired.
    Timeout,
    /// Wait for source to have more bytes as it doesn't have more bytes currently.
    /// (Enter tail mode for files)
    Waiting,
    /// Source data exchange was sent and needed to be passed to byte-source.
    Sde(SdeMsg),
}

pub async fn run_source<S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: &stypes::ParserType,
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
    parser: &stypes::ParserType,
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
            let producer = MessageProducer::new(parser, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::SomeIp(settings) => {
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            let producer = MessageProducer::new(someip_parser, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::Text(()) => {
            let producer = MessageProducer::new(StringTokenizer {}, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
        stypes::ParserType::Dlt(settings) => {
            let fmt_options = Some(FormatOptions::from(settings.tz.as_ref()));
            let someip_metadata = settings.fibex_file_paths.as_ref().and_then(|paths| {
                FibexSomeipMetadata::from_fibex_files(paths.iter().map(PathBuf::from).collect())
            });
            let dlt_parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata.as_ref(),
                fmt_options.as_ref(),
                someip_metadata.as_ref(),
                settings.with_storage_header,
            );
            let producer = MessageProducer::new(dlt_parser, source);
            run_producer(operation_api, state, source_id, producer, rx_tail, rx_sde).await
        }
    }
}

async fn run_producer<P: Parser, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u16,
    mut producer: MessageProducer<P, S>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
    mut rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    use log::debug;
    state.set_session_file(None).await?;
    operation_api.processing();
    let mut logs_writer = LogsWriter::new(state.clone(), source_id);
    let cancel = operation_api.cancellation_token();
    let cancel_on_tail = cancel.clone();

    // We need to show the users some logs quick as possible by starting of the session.
    let mut first_run = true;
    while let Some(next) = select! {
        next_from_stream = async {
            match timeout(Duration::from_millis(FLUSH_TIMEOUT_IN_MS as u64), producer.produce_next(&mut logs_writer)).await {
                Ok(Ok(summary)) => {
                match summary {
                    ProduceSummary::Processed {
                        bytes_consumed,
                        messages_count,
                        skipped_bytes,
                    } => {
                        log::trace!(
                            "{bytes_consumed} Bytes consumed to produce {messages_count} items,\
                            with {skipped_bytes} bytes skipped."
                        );
                        Some(Next::ItemsProduced)
                    }
                    ProduceSummary::Done {
                        loaded_bytes,
                        skipped_bytes,
                        produced_messages,
                    } => {
                        log::debug!(
                            "Producer done: Total Messages: {produced_messages}. Total bytes:\
                            {loaded_bytes}. Total skipped bytes {skipped_bytes}."
                        );

                        Some(Next::ProducerDone)
                    }
                    ProduceSummary::NoBytesAvailable {skipped_bytes} => {
                        log::trace!("No more bytes avaialbe with skipped {skipped_bytes} bytes. Going into tail");

                        Some(Next::Waiting)
                    }
                }
                },
                Ok(Err(producer_err)) => {
                    //TODO: Deliver errors to UI.
                    log::error!("Producer Error: {producer_err}");
                    match producer_err {
                        // Break directly on unrecoverable and byte source errors.
                        ProduceError::Unrecoverable(_) | ProduceError::SourceError(_)  => {
                            // We need to print stopping errors for now as we don't have a solution
                            // to show them to user.
                            eprintln!("Unrecoverable error during producer session: {producer_err}");
                            None
                        },
                        // Go into tailing mode on parse error since they are delivered only
                        // where there is no more bytes in the source.
                        ProduceError::Parse(_) => Some(Next::Waiting),
                    }
                }
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
            Next::ItemsProduced => {
                logs_writer.write_to_session().await?;
                if first_run {
                    first_run = false;
                    state.flush_session_file().await?;
                }
            }
            Next::ProducerDone => {
                logs_writer.write_to_session().await?;

                state.flush_session_file().await?;
                state.file_read().await?;
                break;
            }
            Next::Timeout => {
                logs_writer.write_to_session().await?;
                if !state.is_closing() {
                    state.flush_session_file().await?;
                }
            }
            Next::Waiting => {
                logs_writer.write_to_session().await?;
                if !state.is_closing() {
                    state.flush_session_file().await?;
                    state.file_read().await?;
                }
                if let Some(rx_tail) = rx_tail.as_mut() {
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
