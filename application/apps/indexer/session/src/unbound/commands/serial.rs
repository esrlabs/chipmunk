use crate::unbound::signal::Signal;

pub fn available_ports(
    _signal: Signal,
) -> Result<stypes::CommandOutcome<stypes::SerialPortsList>, stypes::ComputationError> {
    serialport::available_ports()
        .map_err(|e| stypes::ComputationError::IoOperation(e.to_string()))
        .map(|ports| {
            stypes::CommandOutcome::Finished(stypes::SerialPortsList(
                ports
                    .into_iter()
                    .map(|p| p.port_name)
                    .collect::<Vec<String>>(),
            ))
        })
}
