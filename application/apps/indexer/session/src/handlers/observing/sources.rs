use crate::{
    events::{NativeError, NativeErrorKind},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use sources::{
    command,
    factory::{
        ParserType, ProcessTransportConfig, SerialTransportConfig, TCPTransportConfig, Transport,
        UDPTransportConfig,
    },
    pcap, raw, serial, socket, ByteSource,
};
use std::{fs::File, path::PathBuf};

pub async fn stream(transport: &Transport) -> Result<Box<dyn ByteSource>, NativeError> {
    match transport {
        Transport::UDP(settings) => udp(settings).await,
        Transport::TCP(settings) => tcp(settings).await,
        Transport::Serial(settings) => serial(settings).await,
        Transport::Process(settings) => cmd(settings).await,
    }
}

pub fn file(parser: &ParserType, filename: &PathBuf) -> Result<Box<dyn ByteSource>, NativeError> {
    match parser {
        ParserType::SomeIP(_) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::FileNotFound,
            message: Some(String::from("SomeIP parser not yet supported")),
        }),
        ParserType::Pcap(_) => pcap(filename),
        ParserType::Dlt(_) => binary(filename),
        ParserType::Text => binary(filename),
    }
}

fn binary(filename: &PathBuf) -> Result<Box<dyn ByteSource>, NativeError> {
    Ok(Box::new(raw::binary::BinaryByteSource::new(
        File::open(filename).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail open file {}: {}",
                filename.to_string_lossy(),
                e
            )),
        })?,
    )))
}

fn pcap(filename: &PathBuf) -> Result<Box<dyn ByteSource>, NativeError> {
    Ok(Box::new(
        pcap::file::PcapngByteSource::new(File::open(filename).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail open file {}: {}",
                filename.to_string_lossy(),
                e
            )),
        })?)
        .map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!(
                "Fail create source for {}: {}",
                filename.to_string_lossy(),
                e
            )),
        })?,
    ))
}

async fn udp(config: &UDPTransportConfig) -> Result<Box<dyn ByteSource>, NativeError> {
    Ok(Box::new(
        socket::udp::UdpSource::new(&config.bind_addr, config.multicast.clone())
            .await
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Interrupted,
                message: Some(format!("Fail to create socket due error: {:?}", e)),
            })?,
    ))
}

async fn tcp(config: &TCPTransportConfig) -> Result<Box<dyn ByteSource>, NativeError> {
    Ok(Box::new(
        socket::tcp::TcpSource::new(config.bind_addr.clone())
            .await
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Interrupted,
                message: Some(format!("Fail to create socket due error: {:?}", e)),
            })?,
    ))
}

async fn cmd(config: &ProcessTransportConfig) -> Result<Box<dyn ByteSource>, NativeError> {
    Ok(Box::new(
        command::process::ProcessSource::new(
            config.command.clone(),
            config.args.clone(),
            config.envs.clone(),
        )
        .await
        .map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Interrupted,
            message: Some(format!("Fail to create process source due error: {:?}", e)),
        })?,
    ))
}

async fn serial(config: &SerialTransportConfig) -> Result<Box<dyn ByteSource>, NativeError> {
    Ok(Box::new(
        serial::serialport::SerialSource::new(config).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Interrupted,
            message: Some(format!(
                "Fail to create serial connection due error: {:?}",
                e
            )),
        })?,
    ))
}

pub async fn get_source_id(state: &SessionStateAPI, uuid: &str) -> Result<u8, NativeError> {
    state.add_source(uuid).await
}
