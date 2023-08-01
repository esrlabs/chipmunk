use super::{runner, CommandOutcome};
use crate::{events::ComputationError, unbound::signal::Signal};
use sources::{
    factory::{FileFormat, ParserType},
    pcap::file::PcapngByteSource,
    raw::binary::BinaryByteSource,
};
use std::{fs::File, path::Path};

#[allow(clippy::type_complexity)]
pub async fn observe_file<'a>(
    signal: Signal,
    file_format: &FileFormat,
    filename: &Path,
    parser: &'a ParserType,
) -> Result<CommandOutcome<String>, ComputationError> {
    match file_format {
        FileFormat::Binary => {
            let source = BinaryByteSource::new(input_file(filename)?);
            runner::run_source(signal, source, parser).await
        }
        FileFormat::PcapNG => {
            let source = PcapngByteSource::new(input_file(filename)?)
                .map_err(|e| ComputationError::IoOperation(e.to_string()))?;
            runner::run_source(signal, source, parser).await
        }
        FileFormat::Text => Err(ComputationError::OperationNotSupported(
            "Text file cannot be overviewed".into(),
        )),
    }
}

fn input_file(filename: &Path) -> Result<File, ComputationError> {
    File::open(filename).map_err(|e| ComputationError::IoOperation(e.to_string()))
}
