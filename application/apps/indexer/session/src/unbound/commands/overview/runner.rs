use super::CommandOutcome;
use std::path::PathBuf;

use crate::{events::ComputationError, unbound::signal::Signal};
use log::trace;
use parsers::{
    dlt::DltParser, someip::SomeipParser, LogMessage, MessageStreamItem, ParseYield, Parser,
};
use sources::{factory::ParserType, producer::MessageProducer, ByteSource};

use tokio_stream::StreamExt;

pub async fn run_source<S: ByteSource>(
    signal: Signal,
    source: S,
    parser: &ParserType,
) -> Result<CommandOutcome<String>, ComputationError> {
    match parser {
        ParserType::SomeIp(settings) => {
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            let producer = MessageProducer::new(someip_parser, source, None);
            run_producer(signal, producer).await
        }
        ParserType::Text => Err(ComputationError::OperationNotSupported(
            "Text parser cannot be used for overview".into(),
        )),
        ParserType::Dlt(settings) => {
            let dlt_parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata.as_ref(),
                settings.with_storage_header,
            );
            let producer = MessageProducer::new(dlt_parser, source, None);
            run_producer(signal, producer).await
        }
    }
}

async fn run_producer<T: LogMessage, P: Parser<T>, S: ByteSource>(
    signal: Signal,
    mut producer: MessageProducer<T, P, S>,
) -> Result<CommandOutcome<String>, ComputationError> {
    use log::debug;
    let stream = producer.as_stream();
    futures::pin_mut!(stream);
    while let Some((_, item)) = stream.next().await {
        match item {
            MessageStreamItem::Item(ParseYield::Message(_item)) => {
                if signal.is_cancelled() {
                    break;
                }
                // do it
            }
            MessageStreamItem::Item(ParseYield::MessageAndAttachment((_item, _attachment))) => {
                // Ignore for now;
            }
            MessageStreamItem::Item(ParseYield::Attachment(_attachment)) => {
                // Ignore for now;
            }
            MessageStreamItem::Done => {
                trace!("observe, message stream is done");
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
    debug!("listen done");
    Ok(CommandOutcome::Finished(String::from("{ }")))
}
