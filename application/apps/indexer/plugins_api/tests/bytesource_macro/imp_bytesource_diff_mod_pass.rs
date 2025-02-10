struct Dummy;

// Module where `Parser` is implemented
mod impl_mod {
    use super::*;

    impl plugins_api::bytesource::ByteSource for Dummy {
        fn get_version() -> plugins_api::shared_types::Version {
            todo!()
        }

        fn get_config_schemas() -> Vec<plugins_api::shared_types::ConfigSchemaItem> {
            todo!()
        }

        fn create(
            _general_configs: plugins_api::bytesource::SourceConfig,
            _plugins_configs: Vec<plugins_api::shared_types::ConfigItem>,
        ) -> Result<Self, plugins_api::shared_types::InitError>
        where
            Self: Sized,
        {
            todo!()
        }

        fn read(&mut self, _len: usize) -> Result<Vec<u8>, plugins_api::bytesource::SourceError> {
            todo!()
        }
    }
}

// Module for export macro
mod export_mod {
    use super::Dummy;

    plugins_api::bytesource_export!(Dummy);
}

pub fn main() {}
