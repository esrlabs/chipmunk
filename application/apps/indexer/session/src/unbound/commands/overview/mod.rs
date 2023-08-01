use super::CommandOutcome;
use crate::{events::ComputationError, unbound::signal::Signal};
use sources::factory::{ObserveOptions, ObserveOrigin, ParserType};
mod file;
mod runner;

pub async fn get_overview(
    mut options: ObserveOptions,
    signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    if let ParserType::Dlt(ref mut settings) = options.parser {
        settings.load_fibex_metadata();
    };
    match &options.origin {
        ObserveOrigin::File(_uuid, file_origin, filename) => {
            file::observe_file(signal, file_origin, filename, &options.parser).await
        }
        ObserveOrigin::Concat(_files) => Err(ComputationError::OperationNotSupported("NYI".into())),
        ObserveOrigin::Stream(_uuid, _transport) => Err(ComputationError::OperationNotSupported(
            "No way to get overview from stream".into(),
        )),
    }
}
