use plugins_api::parser::*;
use plugins_api::*;

struct Dummy;

impl crate::parser::Parser for Dummy {
    fn get_version() -> Version {
        todo!()
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        todo!()
    }

    fn create(
        _general_configs: ParserConfig,
        _plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        todo!()
    }

    fn parse(
        &mut self,
        _data: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
        Ok(std::iter::empty())
    }
}

parser_export!(Dummy);

pub fn main() {}
