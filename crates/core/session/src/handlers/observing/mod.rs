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
use processor::producer::{FetchInfo, MessageProducer, ProcessError, ProcessOutcome};
use sources::{
    ByteSource,
    sde::{SdeMsg, SdeReceiver},
};
use tokio::{
    select,
    sync::mpsc::Receiver,
    time::{Duration, Instant, sleep_until},
};

pub mod concat;
pub mod file;
mod logs_writer;
pub mod stream;

/// Interval at which the items produced so far are flushed to the UI.
pub const FLUSH_TIMEOUT_IN_MS: u64 = 500;

/// Schedules the flushes which deliver the produced items to the UI.
///
/// The next flush is kept as an absolute deadline so that the schedule survives any number of
/// fetch and process rounds: a timeout wrapped around fetching alone would be renewed by every
/// fetch, and a source dribbling bytes could starve flushing for an unbounded time.
struct FlushSchedule {
    interval: Duration,
    deadline: Instant,
}

impl FlushSchedule {
    fn new(interval: Duration) -> Self {
        Self {
            interval,
            deadline: Instant::now() + interval,
        }
    }

    /// The instant at which the next flush is due.
    fn deadline(&self) -> Instant {
        self.deadline
    }

    /// Advances the deadline to the next flush interval.
    ///
    /// Must be called whenever the current deadline is consumed, independent of whether an
    /// actual flush happens: otherwise `sleep_until(deadline)` stays ready forever and the loop
    /// busy-spins instead of waiting for the next interval.
    fn reschedule(&mut self) {
        self.deadline = Instant::now() + self.interval;
    }

    /// Flushes everything written to the session file so far and schedules the next flush.
    async fn flush(&mut self, state: &SessionStateAPI) -> Result<(), stypes::NativeError> {
        state.flush_session_file().await?;
        self.reschedule();

        Ok(())
    }
}

/// The event which the processing loop of a source observed in the current iteration.
/// This is for internal representation only.
enum LoopEvent {
    /// Bytes have been fetched from the byte-source and still need to be processed
    /// outside of the `select!` macro.
    Fetched(FetchInfo),
    /// Flush timeout while waiting for next items has expired.
    Timeout,
    /// Source data exchange was sent and needed to be passed to byte-source.
    Sde(SdeMsg),
}

/// Represents the work the processing loop has to do once parsing has run.
/// This is for internal representation only.
enum LoopAction {
    /// Write the items which have been produced to the session file.
    WriteItems,
    /// Finish the session as the producer can't load or parse anymore.
    Finish,
    /// Nothing to do currently. Go back to fetching more bytes.
    Continue,
    /// Flush the items which have been produced so far to the UI.
    Flush,
    /// Wait for the source to have more bytes as it doesn't have more bytes currently.
    /// (Enter tail mode for files)
    Wait,
    /// Pass the sent source data exchange to the byte-source.
    Sde(SdeMsg),
    /// Terminate the session.
    Stop,
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
            let filter_config = settings.filter_config.clone();
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => SomeipParser::from_fibex_files(
                    filter_config,
                    paths.iter().map(PathBuf::from).collect(),
                ),
                None => SomeipParser::new(filter_config),
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
    state.create_session_file().await?;
    operation_api.processing();
    let mut logs_writer = LogsWriter::new(state.clone(), source_id);
    let cancel = operation_api.cancellation_token();
    let cancel_on_tail = cancel.clone();

    // We need to show the users some logs quick as possible by starting of the session.
    let mut first_run = true;

    let mut flush_schedule = FlushSchedule::new(Duration::from_millis(FLUSH_TIMEOUT_IN_MS));

    loop {
        // *** Cancel Safety ***:
        // Every future here must be cancel safe. Parsing is done on `producer.process()`
        // below, outside of this macro, because it isn't cancel safe.
        let next_event = select! {
            fetch_result = producer.fetch() => {
                match fetch_result {
                    Ok(fetch_info) => Some(LoopEvent::Fetched(fetch_info)),
                    Err(source_err) => {
                        //TODO: Deliver errors to UI.
                        log::error!("Producer Error: {source_err}");
                        // We need to print stopping errors for now as we don't have a solution
                        // to show them to user.
                        eprintln!("Unrecoverable error during producer session: {source_err}");

                        None
                    }
                }
            },

            _ = sleep_until(flush_schedule.deadline()) => Some(LoopEvent::Timeout),

            Some(sde_msg) = async {
                if let Some(rx_sde) = rx_sde.as_mut() {
                    rx_sde.recv().await
                } else {
                    None
                }
            } => Some(LoopEvent::Sde(sde_msg)),

            _ = cancel.cancelled() => None,
        };

        let Some(next) = next_event else {
            break;
        };

        let action = match next {
            // Parsing happens here only: outside of the `select!` macro, where it can't be
            // cancelled halfway through.
            LoopEvent::Fetched(fetch_info) => {
                match producer.process(fetch_info, &mut logs_writer) {
                    Ok(outcome) => match outcome {
                        ProcessOutcome::Parsed {
                            bytes_consumed,
                            messages_count,
                            skipped_bytes,
                        } => {
                            log::trace!(
                                "{bytes_consumed} Bytes consumed to produce {messages_count} items,\
                            with {skipped_bytes} bytes skipped."
                            );

                            LoopAction::WriteItems
                        }
                        ProcessOutcome::NeedMoreBytes => LoopAction::Continue,
                        ProcessOutcome::PendingRemainder => {
                            // The parser holds a partial item and the source has stalled. A
                            // source that stops delivering is usually finished rather than
                            // paused mid-item, so give the parser the chance to close the item
                            // now instead of holding it for the life of the session. Parsers
                            // which can't complete a partial item keep their bytes, so a growing
                            // file still completes them.
                            if let Err(err) = producer.process_remaining(&mut logs_writer) {
                                log::error!("Producer Error: {err}");
                            }

                            LoopAction::Wait
                        }
                        ProcessOutcome::NoData => {
                            log::trace!(
                                "No more bytes available with {} bytes skipped in total. Going into tail",
                                producer.total_skipped_bytes()
                            );

                            LoopAction::Wait
                        }
                        ProcessOutcome::Done => {
                            log::debug!(
                                "Producer done: Total Messages: {}. Total bytes: {}. Total skipped bytes {}.",
                                producer.total_produced_items(),
                                producer.total_loaded_bytes(),
                                producer.total_skipped_bytes()
                            );

                            LoopAction::Finish
                        }
                    },
                    Err(process_err) => {
                        //TODO: Deliver errors to UI.
                        log::error!("Producer Error: {process_err}");
                        match process_err {
                            // Break directly on unrecoverable errors.
                            ProcessError::Unrecoverable(_) => {
                                // We need to print stopping errors for now as we don't have a
                                // solution to show them to user.
                                eprintln!(
                                    "Unrecoverable error during producer session: {process_err}"
                                );

                                LoopAction::Stop
                            }
                            // Go into tailing mode on parse error since they are delivered only
                            // where there is no more bytes in the source.
                            ProcessError::Parse(_) => LoopAction::Wait,
                        }
                    }
                }
            }
            LoopEvent::Timeout => {
                flush_schedule.reschedule();

                LoopAction::Flush
            }
            LoopEvent::Sde(sde_msg) => LoopAction::Sde(sde_msg),
        };

        match action {
            LoopAction::WriteItems => {
                logs_writer.write_to_session().await?;
                if first_run {
                    first_run = false;
                    flush_schedule.flush(&state).await?;
                }
            }
            LoopAction::Finish => {
                logs_writer.write_to_session().await?;

                flush_schedule.flush(&state).await?;
                state.file_read().await?;
                break;
            }
            LoopAction::Continue => {}
            LoopAction::Flush => {
                logs_writer.write_to_session().await?;
                if !state.is_closing() {
                    flush_schedule.flush(&state).await?;
                }
            }
            LoopAction::Wait => {
                logs_writer.write_to_session().await?;
                if !state.is_closing() {
                    flush_schedule.flush(&state).await?;
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
            LoopAction::Sde((msg, tx_response)) => {
                let sde_res = producer.sde_income(msg).await.map_err(|e| e.to_string());
                if tx_response.send(sde_res).is_err() {
                    log::warn!("Fail to send back message from source");
                }
            }
            LoopAction::Stop => break,
        }
    }
    log::debug!("listen done");
    Ok(None)
}
