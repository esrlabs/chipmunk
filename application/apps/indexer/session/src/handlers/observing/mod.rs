use std::path::PathBuf;

use crate::{
    operations::{OperationAPI, OperationResult},
    parse_rest_resolver::{resolve_log_msg, ParseRestReslover},
    state::SessionStateAPI,
    tail,
};
use log::trace;
use parsers::{
    dlt::{fmt::FormatOptions, DltParser},
    someip::SomeipParser,
    text::StringTokenizer,
    LogMessage, MessageStreamItem, ParseYield, Parser,
};
use sources::{
    factory::ParserType,
    producer::{MessageProducer, SdeReceiver},
    ByteSource,
};
use tokio::{
    select,
    sync::mpsc::Receiver,
    time::{timeout, Duration},
};
use tokio_stream::StreamExt;

enum Next<T: LogMessage> {
    Item(MessageStreamItem<T>),
    Timeout,
    Waiting,
}

pub mod concat;
pub mod file;
pub mod stream;

pub const FLUSH_TIMEOUT_IN_MS: u128 = 500;

pub async fn run_source<S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: &ParserType,
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
    parser: &ParserType,
    rx_sde: Option<SdeReceiver>,
    rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    let mut parse_err_resolver = ParseRestReslover::new();
    match parser {
        ParserType::SomeIp(settings) => {
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            let producer = MessageProducer::new(someip_parser, source, rx_sde);
            run_producer(
                operation_api,
                state,
                source_id,
                producer,
                rx_tail,
                &mut parse_err_resolver,
            )
            .await
        }
        ParserType::Text => {
            let producer = MessageProducer::new(StringTokenizer {}, source, rx_sde);
            run_producer(
                operation_api,
                state,
                source_id,
                producer,
                rx_tail,
                &mut parse_err_resolver,
            )
            .await
        }
        ParserType::Dlt(settings) => {
            let fmt_options = Some(FormatOptions::from(settings.tz.as_ref()));
            let dlt_parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata.as_ref(),
                fmt_options.as_ref(),
                settings.with_storage_header,
            );
            let producer = MessageProducer::new(dlt_parser, source, rx_sde);

            let someip_parse = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            parse_err_resolver.with_someip_parser(someip_parse);

            run_producer(
                operation_api,
                state,
                source_id,
                producer,
                rx_tail,
                &mut parse_err_resolver,
            )
            .await
        }
    }
}

async fn run_producer<T: LogMessage, P: Parser<T>, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u16,
    mut producer: MessageProducer<T, P, S>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
    parse_err_resolver: &mut ParseRestReslover,
) -> OperationResult<()> {
    use log::debug;
    state.set_session_file(None).await?;
    operation_api.processing();
    let cancel = operation_api.cancellation_token();
    let stream = producer.as_stream();
    futures::pin_mut!(stream);
    let cancel_on_tail = cancel.clone();
    while let Some(next) = select! {
        next_from_stream = async {
            match timeout(Duration::from_millis(FLUSH_TIMEOUT_IN_MS as u64), stream.next()).await {
                Ok(item) => {
                    if let Some((_, item)) = item {
                        Some(Next::Item(item))
                    } else {
                        Some(Next::Waiting)
                    }
                },
                Err(_) => Some(Next::Timeout),
            }
        } => next_from_stream,
        _ = cancel.cancelled() => None,
    } {
        match next {
            Next::Item(item) => {
                match item {
                    MessageStreamItem::Item(ParseYield::Message(item)) => {
                        let msg = resolve_log_msg(item, parse_err_resolver);
                        state
                            .write_session_file(source_id, format!("{msg}\n"))
                            .await?;
                    }
                    MessageStreamItem::Item(ParseYield::MessageAndAttachment((
                        item,
                        attachment,
                    ))) => {
                        let msg = resolve_log_msg(item, parse_err_resolver);
                        state
                            .write_session_file(source_id, format!("{msg}\n"))
                            .await?;
                        state.add_attachment(attachment)?;
                    }
                    MessageStreamItem::Item(ParseYield::Attachment(attachment)) => {
                        state.add_attachment(attachment)?;
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
        }
    }
    debug!("listen done");
    Ok(None)
}
