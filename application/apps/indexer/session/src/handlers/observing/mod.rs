use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use indexer_base::progress::Severity;
use log::trace;
use parsers::{
    dlt::DltParser, text::StringTokenizer, LogMessage, MessageStreamItem, ParseYield, Parser,
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
    source_id: u8,
    parser: &ParserType,
    rx_sde: Option<SdeReceiver>,
    rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    match parser {
        ParserType::SomeIP(_) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::UnsupportedFileType,
            message: Some(String::from("SomeIP parser not yet supported")),
        }),
        ParserType::Text => {
            let producer = MessageProducer::new(StringTokenizer {}, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
        ParserType::Pcap(settings) => {
            let parser = DltParser::new(
                settings.dlt.filter_config.as_ref().map(|f| f.into()),
                settings.dlt.fibex_metadata.as_ref(),
                settings.dlt.with_storage_header,
            );
            let producer = MessageProducer::new(parser, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
        ParserType::Dlt(settings) => {
            let dlt_parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata.as_ref(),
                settings.with_storage_header,
            );
            let producer = MessageProducer::new(dlt_parser, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
    }
}

async fn run_producer<T: LogMessage, P: Parser<T>, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u8,
    mut producer: MessageProducer<T, P, S>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
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
