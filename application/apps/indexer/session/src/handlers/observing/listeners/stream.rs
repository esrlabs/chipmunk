use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use sources::{
    command::process::ProcessSource,
    factory::{ParserType, Transport},
    producer::SdeReceiver,
    serial::serialport::SerialSource,
    socket::{tcp::TcpSource, udp::UdpSource},
};

pub async fn listen<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    transport: &Transport,
    parser: &'a ParserType,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let source_id = observing::sources::get_source_id(&state, uuid).await?;

    match transport {
        Transport::UDP(settings) => {
            let udp_source = UdpSource::new(&settings.bind_addr, settings.multicast.clone())
                .await
                .map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Interrupted,
                    message: Some(format!("Fail to create socket due error: {:?}", e)),
                })?;
            observing::listeners::run(
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
                .map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Interrupted,
                    message: Some(format!("Fail to create socket due error: {:?}", e)),
                })?;
            observing::listeners::run(
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
            let serial_source = SerialSource::new(settings).map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Interrupted,
                message: Some(format!(
                    "Fail to create serial connection due error: {:?}",
                    e
                )),
            })?;
            observing::listeners::run(
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
                settings.args.clone(),
                settings.envs.clone(),
            )
            .await
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Interrupted,
                message: Some(format!("Fail to create process source due error: {:?}", e)),
            })?;
            observing::listeners::run(
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
