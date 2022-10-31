use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::{SessionStateAPI, NOTIFY_IN_MS},
    tail,
};
use indexer_base::progress::Severity;
use log::trace;
use parsers::{LogMessage, MessageStreamItem, Parser};
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

pub async fn run<'a, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u8,
    parser: &'a ParserType,
    rx_sde: Option<SdeReceiver>,
    rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    match parser {
        ParserType::SomeIP(_) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::FileNotFound,
            message: Some(String::from("SomeIP parser not yet supported")),
        }),
        ParserType::Text => {
            let producer = MessageProducer::new(super::parsers::text()?, source, rx_sde);
            listen(operation_api, state, source_id, producer, rx_tail).await
        }
        ParserType::Pcap(settings) => {
            let producer = MessageProducer::new(
                super::parsers::dlt(&settings.dlt, settings.dlt.fibex_metadata.as_ref())?,
                source,
                rx_sde,
            );
            listen(operation_api, state, source_id, producer, rx_tail).await
        }
        ParserType::Dlt(settings) => {
            let producer = MessageProducer::new(
                super::parsers::dlt(&settings, settings.fibex_metadata.as_ref())?,
                source,
                rx_sde,
            );
            listen(operation_api, state, source_id, producer, rx_tail).await
        }
    }
}

pub async fn listen<T: LogMessage, P: Parser<T>, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u8,
    mut producer: MessageProducer<T, P, S>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
) -> OperationResult<()> {
    use log::debug;
    state.set_session_file(None).await?;
    let cancel = operation_api.cancellation_token();
    let stream = producer.as_stream();
    futures::pin_mut!(stream);
    let cancel_on_tail = cancel.clone();
    operation_api.started();
    while let Some(next) = select! {
        next_from_stream = async {
            match timeout(Duration::from_millis(NOTIFY_IN_MS as u64), stream.next()).await {
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
                    MessageStreamItem::Item(item) => {
                        state
                            .write_session_file(source_id, format!("{}\n", item))
                            .await?;
                    }
                    MessageStreamItem::Done => {
                        trace!("observe, message stream is done");
                        state.flush_session_file(source_id).await?;
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
                    state.flush_session_file(source_id).await?;
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
