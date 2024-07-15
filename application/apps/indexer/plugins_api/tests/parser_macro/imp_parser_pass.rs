use plugins_api::parser::*;
use plugins_api::*;

struct Dummy;

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
    ) -> impl IntoIterator<Item = Result<crate::parser::ParseReturn, crate::parser::ParseError>> + Send
    {
        Vec::new()
    }
}

parser_export!(Dummy);

pub fn main() {}
