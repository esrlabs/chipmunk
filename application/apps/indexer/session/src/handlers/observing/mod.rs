use std::path::PathBuf;

use crate::{
    operations::{OperationAPI, OperationResult},
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
use plugins_host::PluginParser;
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
    Items(Vec<(usize, MessageStreamItem<T>)>),
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
    match parser {
        ParserType::Plugin(settings) => {
            println!("------------------------------------------------------");
            println!("-------------    WASM parser used    -----------------");
            println!("------------------------------------------------------");
            let parser = PluginParser::create(
                &settings.plugin_path,
                &settings.general_settings,
                settings.custom_config_path.as_ref(),
            )
            .await?;
            let producer = MessageProducer::new(parser, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
        ParserType::SomeIp(settings) => {
            let someip_parser = match &settings.fibex_file_paths {
                Some(paths) => {
                    SomeipParser::from_fibex_files(paths.iter().map(PathBuf::from).collect())
                }
                None => SomeipParser::new(),
            };
            let producer = MessageProducer::new(someip_parser, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
        ParserType::Text => {
            let producer = MessageProducer::new(StringTokenizer {}, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
        //TODO AAZ: Remove the whole block here a
        ParserType::Dlt(_) if std::env::var("FORCE_PLUGIN").is_ok() => {
            println!("------------------------------------------------------");
            println!("-------------   WASM parser forced   -----------------");
            println!("------------------------------------------------------");

            const PLUGIN_PATH_ENV: &str = "WASM_PLUGIN_PATH";
            //TODO AAZ: Find a better way to deliver plugin path than environment variables
            let plugin_path = match std::env::var(PLUGIN_PATH_ENV) {
                Ok(path) => path,
                Err(err) => panic!("Retrieving plugin path environment variable failed. Err {err}"),
            };
            let proto_plugin_path = PathBuf::from(plugin_path);
            let settings = sources::plugins::PluginParserSettings::prototyping(proto_plugin_path);

            let parser = PluginParser::create(
                &settings.plugin_path,
                &settings.general_settings,
                settings.custom_config_path.as_ref(),
            )
            .await?;
            let producer = MessageProducer::new(parser, source, rx_sde);
            run_producer(operation_api, state, source_id, producer, rx_tail).await
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
            run_producer(operation_api, state, source_id, producer, rx_tail).await
        }
    }
}

async fn run_producer<T: LogMessage, P: Parser<T>, S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source_id: u16,
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
        _ = cancel.cancelled() => None,
    } {
        match next {
            Next::Items(items) => {
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
