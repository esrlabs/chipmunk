use crate::{
    events::{NativeError, NativeErrorKind},
    operations::OperationResult,
    progress::Severity,
    state::SessionStateAPI,
};
use indexer_base::config::IndexSection;
use log::debug;
use parsers::{
    dlt::{fmt::FormatOptions, DltParser},
    someip::SomeipParser,
    text::StringTokenizer,
    LogMessage, MessageStreamItem,
};
use plugins_host::PluginParser;
use processor::export::{export_raw, ExportError};
use sources::{
    binary::{
        pcap::{legacy::PcapLegacyByteSource, ng::PcapngByteSource},
        raw::BinaryByteSource,
    },
    factory::{FileFormat, ParserType},
    producer::MessageProducer,
    ByteSource,
};
use std::{
    fs::File,
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

pub async fn execute_export(
    cancel: &CancellationToken,
    state: SessionStateAPI,
    out_path: PathBuf,
    ranges: Vec<std::ops::RangeInclusive<u64>>,
) -> OperationResult<bool> {
    debug!("RUST: ExportRaw operation is requested");
    let observed = state.get_executed_holder().await?;
    if !observed.is_file_based_export_possible() {
        return Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Configuration,
            message: Some(String::from(
                "For current collection of observing operation raw export isn't possible.",
            )),
        });
    }
    let mut indexes = ranges
        .iter()
        .map(IndexSection::from)
        .collect::<Vec<IndexSection>>();
    let count = observed.get_files().len();
    for (i, (parser, file_format, filename)) in observed.get_files().iter().enumerate() {
        if indexes.is_empty() {
            break;
        }
        let read = if let Some(read) = assing_source(
            filename,
            &out_path,
            parser,
            file_format,
            &indexes,
            i != (count - 1),
            cancel,
        )
        .await?
        {
            read
        } else {
            return Ok(Some(false));
        };
        indexes.iter_mut().for_each(|index| index.left(read));
        indexes = indexes
            .into_iter()
            .filter(|index| !index.is_empty())
            .collect::<Vec<IndexSection>>();
    }
    Ok(Some(true))
}

async fn assing_source(
    src: &PathBuf,
    dest: &Path,
    parser: &ParserType,
    file_format: &FileFormat,
    sections: &Vec<IndexSection>,
    read_to_end: bool,
    cancel: &CancellationToken,
) -> Result<Option<usize>, NativeError> {
    let reader = File::open(src).map_err(|e| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::Io,
        message: Some(format!("Fail open file {}: {}", src.to_string_lossy(), e)),
    })?;
    match file_format {
        FileFormat::Binary | FileFormat::Text => {
            export(
                dest,
                parser,
                BinaryByteSource::new(reader),
                sections,
                read_to_end,
                cancel,
            )
            .await
        }
        FileFormat::PcapNG => {
            export(
                dest,
                parser,
                PcapngByteSource::new(reader)?,
                sections,
                read_to_end,
                cancel,
            )
            .await
        }
        FileFormat::PcapLegacy => {
            export(
                dest,
                parser,
                PcapLegacyByteSource::new(reader)?,
                sections,
                read_to_end,
                cancel,
            )
            .await
        }
    }
}

async fn export<S: ByteSource>(
    dest: &Path,
    parser: &ParserType,
    source: S,
    sections: &Vec<IndexSection>,
    read_to_end: bool,
    cancel: &CancellationToken,
) -> Result<Option<usize>, NativeError> {
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
            let mut producer = MessageProducer::new(parser, source, None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
                false,
                cancel,
            )
            .await
        }
        ParserType::SomeIp(settings) => {
            let parser = if let Some(files) = settings.fibex_file_paths.as_ref() {
                SomeipParser::from_fibex_files(files.iter().map(PathBuf::from).collect())
            } else {
                SomeipParser::new()
            };
            let mut producer = MessageProducer::new(parser, source, None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
                false,
                cancel,
            )
            .await
        }
        ParserType::Dlt(settings) => {
            let fmt_options = Some(FormatOptions::from(settings.tz.as_ref()));
            let parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata.as_ref(),
                fmt_options.as_ref(),
                settings.with_storage_header,
            );
            let mut producer = MessageProducer::new(parser, source, None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
                false,
                cancel,
            )
            .await
        }
        ParserType::Text => {
            let mut producer = MessageProducer::new(StringTokenizer {}, source, None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
                true,
                cancel,
            )
            .await
        }
    }
}

pub async fn export_runner<S, T>(
    s: S,
    dest: &Path,
    sections: &Vec<IndexSection>,
    read_to_end: bool,
    text_file: bool,
    cancel: &CancellationToken,
) -> Result<Option<usize>, NativeError>
where
    T: LogMessage + Sized,
    S: futures::Stream<Item = Vec<(usize, MessageStreamItem<T>)>> + Unpin,
{
    export_raw(s, dest, sections, read_to_end, text_file, cancel)
        .await
        .map_or_else(
            |err| match err {
                ExportError::Cancelled => Ok(None),
                _ => Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::UnsupportedFileType,
                    message: Some(format!("{err}")),
                }),
            },
            |read| Ok(Some(read)),
        )
}
