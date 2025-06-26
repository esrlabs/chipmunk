// #![deny(unused_crate_dependencies)]

use components::Components;
pub mod dlt;
pub mod prelude;
pub mod someip;
pub mod text;

pub enum Parser {
    DltRaw(dlt::raw::DltRawParser),
    Dlt(dlt::DltParser),
    SomeIp(someip::SomeipParser),
    Text(text::StringTokenizer),
}

// TODO: this registration function will fail if some of parser would not be registred. That's wrong.
// If some of parsers are failed, another parsers should still be registred as well
pub fn registration<S>(components: &mut Components<S, Parser>) -> Result<(), stypes::NativeError> {
    components.add_parser(dlt::descriptor::Descriptor::default())?;
    components.add_parser(dlt::raw::descriptor::Descriptor::default())?;
    components.add_parser(someip::descriptor::Descriptor::default())?;
    components.add_parser(text::descriptor::Descriptor::default())?;
    Ok(())
}
