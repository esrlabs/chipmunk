use plugins_api::parser::*;
use plugins_api::*;

struct Dummy;

trait ExtendParser: crate::parser::Parser {}

impl crate::parser::Parser for Dummy {
    fn create(
        _general_configs: crate::parser::ParserConfig,
        _config_path: Option<std::path::PathBuf>,
    ) -> Result<Self, crate::parser::InitError>
    where
        Self: Sized,
    {
        todo!()
    }

    fn parse(
        &mut self,
        _data: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = crate::parser::ParseReturn>, crate::parser::ParseError> {
        Ok(std::iter::empty())
    }
}

impl ExtendParser for Dummy {}

parser_export!(Dummy);

pub fn main() {}