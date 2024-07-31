//! This is an example of a simple Chipmunk bytesource plugin that reads byte data from a file,
//! and provides it to the Chipmunk application.
//!
//! TODO: Complete the documentation

use std::{
    fs::File,
    io::{BufReader, Read},
    path::PathBuf,
};

use plugins_api::bytesource::{ByteSource, InitError, SourceConfig, SourceError};

/// Simple struct that opens a file and read its content, providing them as bytes to Chipmunk when
/// read method for the plugin is called
struct FileSource {
    reader: BufReader<File>,
}

impl ByteSource for FileSource {
    fn create(
        _general_configs: SourceConfig,
        config_path: Option<PathBuf>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        // TODO AAZ: Define Input Source enum in wit file and provide a separate argument for
        // the input sources
        // We are using the config path as file path temporary
        let file_path = config_path.ok_or_else(||
            InitError::Io("Config File must be provided in prototyping phase because it's used as source file path".into())
        )?;
        let file = File::open(file_path).map_err(|err| InitError::Io(err.to_string()))?;
        let reader = BufReader::new(file);

        let source = FileSource { reader };

        Ok(source)
    }

    fn read(&mut self, len: usize) -> Result<Vec<u8>, SourceError> {
        // Initialize a vector with the given length to use as buffer for reading from the file
        let mut buf = vec![0; len];
        let bytes_read = self
            .reader
            .read(&mut buf)
            .map_err(|err| SourceError::Io(format!("Error while reading from file: {}", err)))?;

        // Remove bytes from initialization which haven't been re-written with the actual data.
        if bytes_read < len {
            buf.truncate(bytes_read);
        }

        Ok(buf)
    }
}
