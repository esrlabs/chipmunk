struct Dummy;

// Module where `Parser` is implemented
mod impl_mod {
    use super::*;
    use plugins_api::bytesource::*;
    use std::path::PathBuf;

    impl ByteSource for Dummy {
        fn create(
            _input_source: InputSource,
            _general_configs: SourceConfig,
            _config_path: Option<PathBuf>,
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
}

// Module for export macro
mod export_mod {
    use super::Dummy;
    use plugins_api::bytesource::*;
    use plugins_api::*;

    bytesource_export!(Dummy);
}

pub fn main() {}
