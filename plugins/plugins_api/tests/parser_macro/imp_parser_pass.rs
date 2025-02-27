struct Dummy;

impl plugins_api::parser::Parser for Dummy {
    fn get_version() -> plugins_api::shared_types::Version {
        todo!()
    }

    fn get_config_schemas() -> Vec<plugins_api::shared_types::ConfigSchemaItem> {
        todo!()
    }

    fn get_render_options() -> plugins_api::parser::RenderOptions {
        todo!()
    }

    fn create(
        _general_configs: plugins_api::parser::ParserConfig,
        _plugins_configs: Vec<plugins_api::shared_types::ConfigItem>,
    ) -> Result<Self, plugins_api::shared_types::InitError>
    where
        Self: Sized,
    {
        todo!()
    }

    fn parse(
        &mut self,
        _data: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<
        impl Iterator<Item = plugins_api::parser::ParseReturn>,
        plugins_api::parser::ParseError,
    > {
        Ok(std::iter::empty())
    }
}

plugins_api::parser_export!(Dummy);

pub fn main() {}
