use components::Components;

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

// TODO AAZ:
// - Consider boxing the source since they may vary in memory print.
// - Unusual name used here to avoid naming conflicts with types
//   from `stypes` crate while development
pub enum AllSourceTypes {
    Raw(binary::raw::BinaryByteSourceFromFile),
    Pcap(binary::pcap::legacy::PcapLegacyByteSourceFromFile),
    PcapNg(binary::pcap::ng::PcapngByteSourceFromFile),
    Tcp(socket::tcp::TcpSource),
    Udp(socket::udp::UdpSource),
    Serial(serial::serialport::SerialSource),
    Process(command::ProcessSource),
}

// TODO: this registration function will fail if some of source would not be registred. That's wrong.
// If some of sources are failed, another sources should still be registred as well
pub fn registration<P>(
    components: &mut Components<AllSourceTypes, P>,
) -> Result<(), stypes::NativeError> {
    components.add_source(binary::raw::Descriptor::default())?;
    components.add_source(binary::pcap::legacy::Descriptor::default())?;
    components.add_source(binary::pcap::ng::Descriptor::default())?;
    components.add_source(socket::tcp::Descriptor::default())?;
    components.add_source(socket::udp::Descriptor::default())?;
    components.add_source(serial::descriptor::Descriptor::default())?;
    components.add_source(command::Descriptor::default())?;
    Ok(())
}
