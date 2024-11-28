use super::CommandOutcome;
use crate::{error::ComputationError, unbound::signal::Signal};

pub fn available_ports(_signal: Signal) -> Result<CommandOutcome<Vec<String>>, ComputationError> {
    serialport::available_ports()
        .map_err(|e| ComputationError::IoOperation(e.to_string()))
        .map(|ports| {
            CommandOutcome::Finished(
                ports
                    .into_iter()
                    .map(|p| p.port_name)
                    .collect::<Vec<String>>(),
            )
        })
}
