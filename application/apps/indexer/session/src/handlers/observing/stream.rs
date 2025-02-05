use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use sources::{
    command::process::ProcessSource,
    producer::SdeReceiver,
    serial::serialport::SerialSource,
    socket::{tcp::TcpSource, udp::UdpSource},
};

pub async fn observe_stream(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    transport: &stypes::Transport,
    parser: &stypes::ParserType,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    match transport {
        stypes::Transport::UDP(settings) => {
            let udp_source = UdpSource::new(&settings.bind_addr, settings.multicast.clone())
                .await
                .map_err(|e| stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Interrupted,
                    message: Some(format!("{e}")),
                })?;
            observing::run_source(
                operation_api,
                state,
                udp_source,
                source_id,
                parser,
                rx_sde,
                None,
            )
            .await
        }
        stypes::Transport::TCP(settings) => {
            let tcp_source = TcpSource::new(settings.bind_addr.clone(), None)
                .await
                .map_err(|e| stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Interrupted,
                    message: Some(format!("{e}")),
                })?;
            observing::run_source(
                operation_api,
                state,
                tcp_source,
                source_id,
                parser,
                rx_sde,
                None,
            )
            .await
        }
        stypes::Transport::Serial(settings) => {
            let serial_source = SerialSource::new(settings).map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Interrupted,
                message: Some(format!("{e}")),
            })?;
            observing::run_source(
                operation_api,
                state,
                serial_source,
                source_id,
                parser,
                rx_sde,
                None,
            )
            .await
        }
        stypes::Transport::Process(settings) => {
            let process_source = ProcessSource::new(
                settings.command.clone(),
                settings.cwd.clone(),
                settings.envs.clone(),
            )
            .await
            .map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Interrupted,
                message: Some(format!("{e}")),
            })?;
            observing::run_source(
                operation_api,
                state,
                process_source,
                source_id,
                parser,
                rx_sde,
                None,
            )
            .await
        }
    }
}
