use plugins_api::bytesource::*;
use plugins_api::shared_types::*;
use plugins_api::*;

struct Dummy;

impl ByteSource for Dummy {
    fn get_version() -> Version {
        todo!()
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        todo!()
    }

    fn create(
        _general_configs: SourceConfig,
        _plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        todo!()
    }

    fn read(&mut self, _len: usize) -> Result<Vec<u8>, SourceError> {
        todo!()
    }
}

bytesource_export!(Dummy);

pub fn main() {}
