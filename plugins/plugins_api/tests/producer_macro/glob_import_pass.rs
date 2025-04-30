use plugins_api::producer::*;
use plugins_api::shared_types::*;
use plugins_api::*;

struct Dummy;

impl Producer for Dummy {
    fn get_version() -> Version {
        todo!()
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        todo!()
    }

    fn get_render_options() -> RenderOptions {
        todo!()
    }

    fn create(
        _general_configs: ProducerConfig,
        _plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        Ok(Dummy)
    }

    fn produce_next(&mut self) -> Result<impl Iterator<Item = ProduceReturn>, ProduceError> {
        Ok(std::iter::empty())
    }
}

producer_export!(Dummy);

pub fn main() {}
