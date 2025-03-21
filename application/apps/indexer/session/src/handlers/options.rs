use std::{collections::HashMap, future::Future, pin::Pin, time::Duration};

use crate::operations::{OperationAPI, OperationResult};
use log::error;
use parsers::{dlt::DltParser, someip::SomeipParser, text::StringTokenizer};
use sources::{
    binary::{
        pcap::{legacy::PcapLegacyByteSource, ng::PcapngByteSource},
        raw::BinaryByteSource,
    },
    command::process::ProcessSource,
    serial::serialport::SerialSource,
    socket::{tcp::TcpSource, udp::UdpSource},
};
use tokio::time::sleep;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

type StaticFieldsResult = Result<stypes::StaticFieldDesc, stypes::NativeError>;

type StaticFieldsGetter = fn(&stypes::SourceOrigin, &stypes::Ident) -> StaticFieldsResult;

type LazyFieldsGetter = fn(
    &stypes::SourceOrigin,
    &stypes::Ident,
    CancellationToken,
) -> Pin<Box<dyn Future<Output = StaticFieldsResult> + Send>>;

enum OptionEntity {
    Static(stypes::StaticFieldDesc),
    Lazy(stypes::LazyFieldDesc, LazyFieldsGetter),
}

#[derive(Default)]
pub struct OptionsManager {
    map: HashMap<Uuid, (Option<StaticFieldsGetter>, Option<LazyFieldsGetter>)>,
}

impl OptionsManager {
    pub fn add(
        &mut self,
        ident: Uuid,
        static_fields_handle: Option<StaticFieldsGetter>,
        lazy_fields_handle: Option<LazyFieldsGetter>,
    ) {
        self.map
            .insert(ident, (static_fields_handle, lazy_fields_handle));
    }
    pub fn get_parser_options(
        source_ident: stypes::SourceOrigin,
        parser_ident: stypes::Ident,
    ) -> Result<Vec<stypes::FieldDesc>, stypes::NativeError> {
        Ok(Vec::new())
    }
}

pub async fn get(
    operation_api: OperationAPI,
    source_ident: stypes::SourceOrigin,
    parser_ident: stypes::Ident,
) -> OperationResult<()> {
    let mut manager = OptionsManager::default();

    Ok(None)
}
