struct Dummy;

impl plugins_api::producer::Producer for Dummy {
    fn get_version() -> plugins_api::shared_types::Version {
        todo!()
    }

    fn get_config_schemas() -> Vec<plugins_api::shared_types::ConfigSchemaItem> {
        todo!()
    }

    fn get_render_options() -> plugins_api::producer::RenderOptions {
        todo!()
    }

    async fn create(
        _general_configs: plugins_api::producer::ProducerConfig,
        _plugins_configs: Vec<plugins_api::shared_types::ConfigItem>,
    ) -> Result<Self, plugins_api::shared_types::InitError>
    where
        Self: Sized,
    {
        Ok(Dummy)
    }

    async fn produce_next(
        &mut self,
    ) -> Result<
        impl Iterator<Item = plugins_api::producer::ProduceReturn>,
        plugins_api::producer::ProduceError,
    > {
        Ok(std::iter::empty())
    }
}

plugins_api::producer_export!(Dummy);

pub fn main() {}
