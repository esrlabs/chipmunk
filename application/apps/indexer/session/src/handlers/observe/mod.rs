mod export_raw;
mod session;

use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use components::Components;
use definitions::{ByteSource, LogRecordWriter, Parser};
use processor::producer::{MessageProducer, sde::*};
use sources::Source;
use std::sync::Arc;
use stypes::{SessionAction, SessionSetup};

//TODO AAZ: Why don't we have rx_tail here?
pub async fn observing(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    options: SessionSetup,
    components: Arc<Components<sources::Source, parsers::Parser>>,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    match &options.origin {
        SessionAction::File(..) => {
            let (descriptor, source, parser) = components.setup(&options)?;
            let mut writer =
                session::Writer::new(state.clone(), state.add_source(descriptor).await?);
            Ok(run_session(
                source,
                parser,
                &mut writer,
                operation_api,
                state.clone(),
                None,
            )
            .await?)
        }
        SessionAction::Source => {
            let (descriptor, source, parser) = components.setup(&options)?;
            let mut writer =
                session::Writer::new(state.clone(), state.add_source(descriptor).await?);
            Ok(run_session(
                source,
                parser,
                &mut writer,
                operation_api,
                state.clone(),
                rx_sde,
            )
            .await?)
        }
        SessionAction::Files(files) => {
            // Replacement of concat feature
            for file in files {
                let (descriptor, source, parser) =
                    components.setup(&options.inherit(SessionAction::File(file.to_owned())))?;
                let mut writer =
                    session::Writer::new(state.clone(), state.add_source(descriptor).await?);

                run_session(
                    source,
                    parser,
                    &mut writer,
                    operation_api.clone(),
                    state.clone(),
                    None,
                )
                .await?;
            }
            Ok(Some(()))
        }
        SessionAction::ExportRaw(files, ranges, output) => {
            // We are creating one single writer for all files to keep tracking ranges and current index
            let mut writer = export_raw::ExportWriter::new(output, ranges.clone())?;
            for file in files {
                if operation_api.cancellation_token().is_cancelled() {
                    return Ok(Some(()));
                }
                let (_, source, parser) =
                    components.setup(&options.inherit(SessionAction::File(file.to_owned())))?;

                run_session(
                    source,
                    parser,
                    &mut writer,
                    operation_api.clone(),
                    state.clone(),
                    None,
                )
                .await?;
            }
            Ok(Some(()))
        }
    }
}

/// Matches against all sources then against all parsers to finally
/// runs the session with full generics support.
async fn run_session<W: LogRecordWriter>(
    source: Source,
    parser: parsers::Parser,
    writer: &mut W,
    operation_api: OperationAPI,
    state: SessionStateAPI,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    match source {
        Source::Raw(binary_byte_source_from_file) => {
            run_session_by_praser(
                binary_byte_source_from_file,
                parser,
                writer,
                operation_api,
                state,
                rx_sde,
            )
            .await
        }
        Source::Pcap(pcap_legacy_byte_source_from_file) => {
            run_session_by_praser(
                pcap_legacy_byte_source_from_file,
                parser,
                writer,
                operation_api,
                state,
                rx_sde,
            )
            .await
        }
        Source::PcapNg(pcapng_byte_source_from_file) => {
            run_session_by_praser(
                pcapng_byte_source_from_file,
                parser,
                writer,
                operation_api,
                state,
                rx_sde,
            )
            .await
        }
        Source::Tcp(tcp_source) => {
            run_session_by_praser(tcp_source, parser, writer, operation_api, state, rx_sde).await
        }
        Source::Udp(udp_source) => {
            run_session_by_praser(udp_source, parser, writer, operation_api, state, rx_sde).await
        }
        Source::Serial(serial_source) => {
            run_session_by_praser(serial_source, parser, writer, operation_api, state, rx_sde).await
        }
        Source::Process(process_source) => {
            run_session_by_praser(process_source, parser, writer, operation_api, state, rx_sde)
                .await
        }
    }
}

/// Matches against all parsers to finally run the session with full generics
/// using the provided `ByteSource`.
async fn run_session_by_praser<S: ByteSource, W: LogRecordWriter>(
    source: S,
    parser: parsers::Parser,
    writer: &mut W,
    operation_api: OperationAPI,
    state: SessionStateAPI,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    match parser {
        parsers::Parser::DltRaw(dlt_raw_parser) => {
            //TODO AAZ: Raw parser isn't part of this here.
            let producer = MessageProducer::new(dlt_raw_parser, source, writer);
            export_raw::run_producer(operation_api, producer)
                .await
                .map(|opt| opt.map(|_| ()))
        }
        parsers::Parser::Dlt(dlt_parser) => {
            run_session_full_generic(source, dlt_parser, writer, operation_api, state, rx_sde).await
        }
        parsers::Parser::SomeIp(someip_parser) => {
            run_session_full_generic(source, someip_parser, writer, operation_api, state, rx_sde)
                .await
        }
        parsers::Parser::Text(string_tokenizer) => {
            run_session_full_generic(
                source,
                string_tokenizer,
                writer,
                operation_api,
                state,
                rx_sde,
            )
            .await
        }
    }
}

/// Runs the session with generic `ByteSource`, `Parser` and `LogRecordWriter`
async fn run_session_full_generic<S: ByteSource, P: Parser, W: LogRecordWriter>(
    source: S,
    parser: P,
    writer: &mut W,
    operation_api: OperationAPI,
    state: SessionStateAPI,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let producer = MessageProducer::new(parser, source, writer);
    session::run_producer(operation_api, state, producer, None, rx_sde).await
}
