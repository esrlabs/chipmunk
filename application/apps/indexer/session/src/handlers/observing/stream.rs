use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use sources::{
    command::process::ProcessSource,
    factory::{ParserType, Transport},
    producer::SdeReceiver,
    serial::serialport::SerialSource,
    socket::{tcp::TcpSource, udp::UdpSource},
};

pub async fn observe_stream<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    transport: &Transport,
    parser: &'a ParserType,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    match transport {
        Transport::UDP(settings) => {
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
        Transport::TCP(settings) => {
            let tcp_source = TcpSource::new(settings.bind_addr.clone())
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
        Transport::Serial(settings) => {
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
        Transport::Process(settings) => {
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
