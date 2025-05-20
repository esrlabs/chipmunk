use std::io::Read;

use components::Components;
use definitions::{ReloadInfo, SourceError, SourceFilter};

// Rust can't currently distinguish between dev and none-dev dependencies at the moment. There is
// an open issue for this case: "https://github.com/rust-lang/rust/issues/129637"
#[macro_use]
extern crate lazy_static;

#[macro_use]
extern crate log;

pub mod binary;
pub mod command;
pub mod prelude;
pub mod serial;
pub mod socket;

pub enum Source {
    Raw(binary::raw::BinaryByteSourceFromFile),
    Pcap(binary::pcap::legacy::PcapLegacyByteSourceFromFile),
    PcapNg(binary::pcap::ng::PcapngByteSourceFromFile),
    Tcp(socket::tcp::TcpSource),
    Udp(socket::udp::UdpSource),
    Serial(serial::serialport::SerialSource),
    Process(command::process::ProcessSource),
}

impl definitions::ByteSource for Source {
    fn consume(&mut self, offset: usize) {
        match self {
            Self::Raw(inner) => inner.consume(offset),
            Self::Pcap(inner) => inner.consume(offset),
            Self::PcapNg(inner) => inner.consume(offset),
            Self::Tcp(inner) => inner.consume(offset),
            Self::Udp(inner) => inner.consume(offset),
            Self::Serial(inner) => inner.consume(offset),
            Self::Process(inner) => inner.consume(offset),
        }
    }

    fn current_slice(&self) -> &[u8] {
        match self {
            Self::Raw(inner) => inner.current_slice(),
            Self::Pcap(inner) => inner.current_slice(),
            Self::PcapNg(inner) => inner.current_slice(),
            Self::Tcp(inner) => inner.current_slice(),
            Self::Udp(inner) => inner.current_slice(),
            Self::Serial(inner) => inner.current_slice(),
            Self::Process(inner) => inner.current_slice(),
        }
    }

    fn len(&self) -> usize {
        match self {
            Self::Raw(inner) => inner.len(),
            Self::Pcap(inner) => inner.len(),
            Self::PcapNg(inner) => inner.len(),
            Self::Tcp(inner) => inner.len(),
            Self::Udp(inner) => inner.len(),
            Self::Serial(inner) => inner.len(),
            Self::Process(inner) => inner.len(),
        }
    }

    async fn load(
        &mut self,
        filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        match self {
            Self::Raw(inner) => inner.load(filter).await,
            Self::Pcap(inner) => inner.load(filter).await,
            Self::PcapNg(inner) => inner.load(filter).await,
            Self::Tcp(inner) => inner.load(filter).await,
            Self::Udp(inner) => inner.load(filter).await,
            Self::Serial(inner) => inner.load(filter).await,
            Self::Process(inner) => inner.load(filter).await,
        }
    }

    async fn cancel(&mut self) -> Result<(), SourceError> {
        match self {
            Self::Raw(inner) => inner.cancel().await,
            Self::Pcap(inner) => inner.cancel().await,
            Self::PcapNg(inner) => inner.cancel().await,
            Self::Tcp(inner) => inner.cancel().await,
            Self::Udp(inner) => inner.cancel().await,
            Self::Serial(inner) => inner.cancel().await,
            Self::Process(inner) => inner.cancel().await,
        }
    }

    async fn income(
        &mut self,
        msg: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, SourceError> {
        match self {
            Self::Raw(inner) => inner.income(msg).await,
            Self::Pcap(inner) => inner.income(msg).await,
            Self::PcapNg(inner) => inner.income(msg).await,
            Self::Tcp(inner) => inner.income(msg).await,
            Self::Udp(inner) => inner.income(msg).await,
            Self::Serial(inner) => inner.income(msg).await,
            Self::Process(inner) => inner.income(msg).await,
        }
    }
}

// TODO: this registration function will fail if some of source would not be registred. That's wrong.
// If some of sources are failed, another sources should still be registred as well
pub fn registration<P>(components: &mut Components<Source, P>) -> Result<(), stypes::NativeError> {
    components.add_source(binary::raw::Descriptor::default())?;
    components.add_source(binary::pcap::legacy::Descriptor::default())?;
    components.add_source(binary::pcap::ng::Descriptor::default())?;
    components.add_source(socket::tcp::Descriptor::default())?;
    components.add_source(socket::udp::Descriptor::default())?;
    components.add_source(serial::options::Descriptor::default())?;
    components.add_source(command::process::Descriptor::default())?;
    Ok(())
}
