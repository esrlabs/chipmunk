use plugins_api::bytesource::*;
use plugins_api::*;
use std::path::PathBuf;

struct Dummy;

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

bytesource_export!(Dummy);

pub fn main() {}
