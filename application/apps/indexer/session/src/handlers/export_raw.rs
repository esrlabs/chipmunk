use crate::{
    events::{NativeError, NativeErrorKind},
    operations::OperationResult,
    state::SessionStateAPI,
};
use indexer_base::{config::IndexSection, progress::Severity};
use log::debug;
use parsers::{dlt::DltParser, text::StringTokenizer, LogMessage, MessageStreamItem};
use processor::export::{export_raw, ExportError};
use sources::{
    factory::ParserType, pcap::file::PcapngByteSource, producer::MessageProducer,
    raw::binary::BinaryByteSource,
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
    for (i, (parser, filename)) in observed.get_files().iter().enumerate() {
        if indexes.is_empty() {
            break;
        }
        let read = if let Some(read) = export(
            filename,
            &out_path,
            parser,
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

async fn export(
    src: &PathBuf,
    dest: &Path,
    parser: &ParserType,
    sections: &Vec<IndexSection>,
    read_to_end: bool,
    cancel: &CancellationToken,
) -> Result<Option<usize>, NativeError> {
    let src_file = File::open(src).map_err(|e| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::Io,
        message: Some(format!("Fail open file {}: {}", src.to_string_lossy(), e)),
    })?;
    match parser {
        ParserType::SomeIP(_) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::UnsupportedFileType,
            message: Some(String::from("SomeIP parser not yet supported")),
        }),
        ParserType::Pcap(settings) => {
            let parser = DltParser::new(
                settings.dlt.filter_config.as_ref().map(|f| f.into()),
                settings.dlt.fibex_metadata.as_ref(),
                settings.dlt.with_storage_header,
            );
            let mut producer = MessageProducer::new(parser, PcapngByteSource::new(src_file)?, None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
                cancel,
            )
            .await
        }
        ParserType::Dlt(settings) => {
            let parser = DltParser::new(
                settings.filter_config.as_ref().map(|f| f.into()),
                settings.fibex_metadata.as_ref(),
                settings.with_storage_header,
            );
            let mut producer = MessageProducer::new(parser, BinaryByteSource::new(src_file), None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
                cancel,
            )
            .await
        }
        ParserType::Text => {
            let mut producer =
                MessageProducer::new(StringTokenizer {}, BinaryByteSource::new(src_file), None);
            export_runner(
                Box::pin(producer.as_stream()),
                dest,
                sections,
                read_to_end,
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
    cancel: &CancellationToken,
) -> Result<Option<usize>, NativeError>
where
    T: LogMessage + Sized,
    S: futures::Stream<Item = (usize, MessageStreamItem<T>)> + Unpin,
{
    export_raw(s, dest, sections, read_to_end, cancel)
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
