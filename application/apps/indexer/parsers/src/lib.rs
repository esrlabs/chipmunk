#![deny(unused_crate_dependencies)]

use components::Components;
pub mod dlt;
pub mod prelude;
pub mod someip;
pub mod text;

// TODO AAZ:
// - Consider boxing the parsers since they may vary in memory print.
// - Unusual name used here to avoid naming conflicts with types
//   from `stypes` crate while development
pub enum AllParserTypes {
    //TODO AAZ: Raw parsers are separate category.
    DltRaw(dlt::raw::DltRawParser),
    Dlt(dlt::DltParser),
    SomeIp(someip::SomeipParser),
    Text(text::StringTokenizer),
}

// TODO: this registration function will fail if some of parser would not be registred. That's wrong.
// If some of parsers are failed, another parsers should still be registred as well
pub fn registration<S>(
    components: &mut Components<S, AllParserTypes>,
) -> Result<(), stypes::NativeError> {
    components.add_parser(dlt::descriptor::Descriptor::default())?;
    components.add_parser(dlt::raw::descriptor::Descriptor::default())?;
    components.add_parser(someip::descriptor::Descriptor::default())?;
    components.add_parser(text::descriptor::Descriptor::default())?;
    Ok(())
}
