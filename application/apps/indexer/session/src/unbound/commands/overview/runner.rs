use super::CommandOutcome;
use std::path::PathBuf;

use crate::{events::ComputationError, unbound::signal::Signal};
use log::trace;
use parsers::{
    dlt::DltParser, someip::SomeipParser, LogMessage, LogMessageOverview, MessageStreamItem,
    Overview, ParseYield, Parser,
};
use serde::Serialize;
use sources::{factory::ParserType, producer::MessageProducer, ByteSource};
use tokio_stream::StreamExt;

pub async fn run_source<S: ByteSource>(
    signal: Signal,
    source: S,
    parser: &ParserType,
) -> Result<CommandOutcome<String>, ComputationError> {
    match parser {
        ParserType::SomeIp(_settings) => Err(ComputationError::OperationNotSupported(
            "Not yet implemented".into(),
        )),
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
            run_producer(
                signal,
                DltParser::get_overview_collector().ok_or(
                    ComputationError::OperationNotSupported(
                        "Fail to get overview collector".into(),
                    ),
                )?,
                producer,
            )
            .await
        }
    }
}

async fn run_producer<
    T: LogMessage + LogMessageOverview<O>,
    P: Parser<T>,
    S: ByteSource,
    O: Serialize,
>(
    signal: Signal,
    mut collector: O,
    mut producer: MessageProducer<T, P, S>,
) -> Result<CommandOutcome<String>, ComputationError> {
    let stream = producer.as_stream();
    futures::pin_mut!(stream);
    while let Some((_, item)) = stream.next().await {
        if let MessageStreamItem::Item(ParseYield::Message(item)) = item {
            if signal.is_cancelled() {
                break;
            }
            item.add(&mut collector);
        }
    }
    Ok(CommandOutcome::Finished(
        serde_json::to_string(&collector).map_err(|e| {
            ComputationError::OperationNotSupported(format!(
                "Fail to convert collecter to JSON: {e:?}"
            ))
        })?,
    ))
}
