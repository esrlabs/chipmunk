use std::{
    convert::{TryFrom, TryInto},
    ops::Not,
    path::PathBuf,
};

use super::{error::E, JsIncomeBuffer};
use prost::Message;
use proto::*;
use session::factory;

fn get_as_file(
    opt: &observe::observe_origin::File,
) -> Result<(String, factory::FileFormat, PathBuf), E> {
    Ok((
        opt.name.to_owned(),
        if opt.format == observe::file_format::Type::Text as i32 {
            factory::FileFormat::Text
        } else if opt.format == observe::file_format::Type::Binary as i32 {
            factory::FileFormat::Binary
        } else if opt.format == observe::file_format::Type::PcapNg as i32 {
            factory::FileFormat::PcapNG
        } else if opt.format == observe::file_format::Type::PcapLegacy as i32 {
            factory::FileFormat::PcapLegacy
        } else {
            return Err(E::InvalidValue(String::from("FileFormat")));
        },
        PathBuf::from(opt.path.to_owned()),
    ))
}

fn get_origin_as_file(opt: &observe::observe_origin::File) -> Result<factory::ObserveOrigin, E> {
    let file = get_as_file(opt)?;
    Ok(factory::ObserveOrigin::File(file.0, file.1, file.2))
}

fn get_origin_as_concat(
    opt: &observe::observe_origin::Concat,
) -> Result<factory::ObserveOrigin, E> {
    let mut files = Vec::new();
    for opt in opt.files.iter() {
        files.push(get_as_file(opt)?);
    }
    Ok(factory::ObserveOrigin::Concat(files))
}

fn get_stream_transport(opt: &observe::observe_origin::Stream) -> Result<factory::Transport, E> {
    let transport = opt
        .to_owned()
        .transport
        .ok_or(E::MissedField(String::from("transport")))?
        .transport_oneof
        .ok_or(E::MissedField(String::from("transport")))?;
    Ok(match transport {
        observe::transport::TransportOneof::Process(opt) => {
            factory::Transport::Process(factory::ProcessTransportConfig {
                command: opt.command,
                cwd: PathBuf::from(opt.cwd),
                envs: opt.envs,
            })
        }
        observe::transport::TransportOneof::Serial(opt) => {
            factory::Transport::Serial(factory::SerialTransportConfig {
                path: opt.path,
                baud_rate: opt.baud_rate,
                data_bits: u8::try_from(opt.data_bits)
                    .map_err(|_| E::InvalidValue(String::from("data_bits")))?,
                flow_control: u8::try_from(opt.flow_control)
                    .map_err(|_| E::InvalidValue(String::from("flow_control")))?,
                parity: u8::try_from(opt.parity)
                    .map_err(|_| E::InvalidValue(String::from("parity")))?,
                stop_bits: u8::try_from(opt.stop_bits)
                    .map_err(|_| E::InvalidValue(String::from("stop_bits")))?,
                send_data_delay: u8::try_from(opt.send_data_delay)
                    .map_err(|_| E::InvalidValue(String::from("send_data_delay")))?,
                exclusive: opt.exclusive,
            })
        }
        observe::transport::TransportOneof::Tcp(opt) => {
            factory::Transport::TCP(factory::TCPTransportConfig {
                bind_addr: opt.bind_addr,
            })
        }
        observe::transport::TransportOneof::Udp(opt) => {
            factory::Transport::UDP(factory::UDPTransportConfig {
                bind_addr: opt.bind_addr,
                multicast: opt
                    .multicast
                    .into_iter()
                    .map(|mc| factory::MulticastInfo {
                        multiaddr: mc.multiaddr,
                        interface: mc.interface.is_empty().not().then_some(mc.interface),
                    })
                    .collect(),
            })
        }
    })
}

impl TryInto<factory::ObserveOptions> for JsIncomeBuffer {
    type Error = E;
    fn try_into(self) -> Result<factory::ObserveOptions, E> {
        let decoded = observe::ObserveOptions::decode(&*self.0)?;
        let origin = decoded
            .origin
            .ok_or(E::MissedField(String::from("origin")))?
            .origin_oneof
            .ok_or(E::MissedField(String::from("origin")))?;
        let parser = decoded
            .parser
            .ok_or(E::MissedField(String::from("parser")))?
            .type_oneof
            .ok_or(E::MissedField(String::from("parser")))?;
        let origin = match origin {
            observe::observe_origin::OriginOneof::File(opt) => get_origin_as_file(&opt)?,
            observe::observe_origin::OriginOneof::Concat(opt) => get_origin_as_concat(&opt)?,
            observe::observe_origin::OriginOneof::Stream(opt) => {
                factory::ObserveOrigin::Stream(opt.name.to_owned(), get_stream_transport(&opt)?)
            }
        };
        let parser = match parser {
            observe::parser_type::TypeOneof::Dlt(opt) => {
                factory::ParserType::Dlt(factory::DltParserSettings {
                    filter_config: opt.filter_config.map(|opt| factory::DltFilterConfig {
                        min_log_level: Some(u8::try_from(opt.min_log_level).unwrap_or(0)),
                        app_id_count: opt.app_id_count,
                        app_ids: opt.app_ids.is_empty().not().then_some(opt.app_ids),
                        context_id_count: opt.context_id_count,
                        context_ids: opt.context_ids.is_empty().not().then_some(opt.context_ids),
                        ecu_ids: opt.ecu_ids.is_empty().not().then_some(opt.ecu_ids),
                    }),
                    fibex_file_paths: opt
                        .fibex_file_paths
                        .is_empty()
                        .not()
                        .then_some(opt.fibex_file_paths),
                    with_storage_header: opt.with_storage_header,
                    tz: opt.tz.is_empty().not().then_some(opt.tz),
                    fibex_metadata: None,
                })
            }
            observe::parser_type::TypeOneof::SomeIp(opt) => {
                factory::ParserType::SomeIp(factory::SomeIpParserSettings {
                    fibex_file_paths: opt
                        .fibex_file_paths
                        .is_empty()
                        .not()
                        .then_some(opt.fibex_file_paths),
                })
            }
            observe::parser_type::TypeOneof::Text(_) => factory::ParserType::Text,
        };
        Ok(factory::ObserveOptions { origin, parser })
    }
}