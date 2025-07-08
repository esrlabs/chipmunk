use async_trait::async_trait;
use components::Components;
use definitions::ByteSource;

type SourceDyn = Box<dyn ByteSource>;

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

// TODO: this registration function will fail if some of source would not be registred. That's wrong.
// If some of sources are failed, another sources should still be registred as well
pub fn registration(components: &mut Components) -> Result<(), stypes::NativeError> {
    components.add_source(binary::raw::Descriptor::default())?;
    components.add_source(binary::pcap::legacy::Descriptor::default())?;
    components.add_source(binary::pcap::ng::Descriptor::default())?;
    components.add_source(socket::tcp::Descriptor::default())?;
    components.add_source(socket::udp::Descriptor::default())?;
    components.add_source(serial::descriptor::Descriptor::default())?;
    components.add_source(command::Descriptor::default())?;
    Ok(())
}
