//! This example demonstrates a simple bytesource plugin in Chipmunk.
//! The plugin reads byte data from a file and provides it to the Chipmunk application.
//! This example will guide you through creating and configuring a plugin using the provided configurations, as well as utilizing support functions from this library, such as logging.

use std::{
    fs::File,
    io::{BufReader, Read},
    path::PathBuf,
};

use plugins_api::{
    bytesource::{ByteSource, SourceConfig, SourceError},
    bytesource_export, config, log,
    shared_types::{ConfigItem, ConfigSchemaItem, ConfigSchemaType, InitError, Version},
};

const INPUT_PATH_ID: &str = "input-path";

/// Simple struct that opens a file and read its content, providing them as bytes to Chipmunk when
/// read method for the plugin is called
struct FileSource {
    reader: BufReader<File>,
}

/// Struct must implement [`ByteSource`] trait to be compiled as a byte-source plugin in Chipmunk.
impl ByteSource for FileSource {
    fn get_version() -> Version {
        Version::new(0, 1, 0)
    }

    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        vec![ConfigSchemaItem::new(
            INPUT_PATH_ID,
            "File Path",
            Some("The path of the input file to read from"),
            ConfigSchemaType::Files(Vec::new()),
        )]
    }

    fn create(
        general_configs: SourceConfig,
        plugins_configs: Vec<ConfigItem>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        // Demonstrates log functionality
        log::debug!(
            "Plugin initialize called with the general settings: {:?}",
            general_configs
        );

        log::debug!(
            "Plugin initialize called with custom configs: {:#?}",
            plugins_configs
        );

        // *** Configuration validation using the helper function ***
        let file_paths = config::get_as_files(INPUT_PATH_ID, &plugins_configs)?;
        if file_paths.len() != 1 {
            let err_msg = format!("Pluign expects one file only but got: {:?}", file_paths);
            return Err(InitError::Config(err_msg));
        }
        let file_path = PathBuf::from(&file_paths[0]);

        // *** Plugins initialization ***
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

        // Remove uninitialized bytes from the buffer which haven't been re-written with the file data.
        if bytes_read < len {
            buf.truncate(bytes_read);
        }

        Ok(buf)
    }
}

bytesource_export!(FileSource);
