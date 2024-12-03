use plugins_api::bytesource::*;
use plugins_api::*;
use std::path::PathBuf;

trait ExtendTrait: ByteSource {}

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

impl ExtendTrait for Dummy {}

bytesource_export!(Dummy);

pub fn main() {}
