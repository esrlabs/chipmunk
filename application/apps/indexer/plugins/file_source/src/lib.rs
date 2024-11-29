//! This example demonstrates a simple bytesource plugin in Chipmunk.
//! The plugin reads byte data from a file and provides it to the Chipmunk application.
//! This example will guide you through creating and configuring a plugin using the provided configurations, as well as utilizing support functions from this library, such as logging.

use std::{
    fs::File,
    io::{BufReader, Read},
    path::PathBuf,
};

use plugins_api::{
    bytesource::{
        ByteSource, ConfigItem, ConfigSchemaItem, ConfigSchemaType, ConfigValue, InitError,
        SourceConfig, SourceError,
    },
    bytesource_export, log,
};

const INPUT_PATH_ID: &str = "input-path";

/// Simple struct that opens a file and read its content, providing them as bytes to Chipmunk when
/// read method for the plugin is called
struct FileSource {
    reader: BufReader<File>,
}

/// Struct must implement [`ByteSource`] trait to be compiled as a byte-source plugin in Chipmunk.
impl ByteSource for FileSource {
    fn get_config_schemas() -> Vec<ConfigSchemaItem> {
        vec![ConfigSchemaItem::new(
            INPUT_PATH_ID,
            "File Path",
            Some("The path of the input file to read from"),
            ConfigSchemaType::Path,
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

        // Plugin Initialization
        let file_path_config = plugins_configs
            .iter()
            .find(|item| item.id == INPUT_PATH_ID)
            .ok_or_else(|| {
                InitError::Config(format!(
                    " No configuration value for id '{INPUT_PATH_ID}' is provided"
                ))
            })?;

        let file_path = match &file_path_config.value {
            ConfigValue::Path(path) => PathBuf::from(path),
            invalid => {
                let err_msg = format!(
                    "Invalid config value for '{INPUT_PATH_ID}' was provided. Value: {:?}",
                    invalid
                );
                return Err(InitError::Config(err_msg));
            }
        };

        let file = File::open(file_path).map_err(|err| InitError::Io(err.to_string()))?;
        let reader = BufReader::new(file);

        let source = FileSource { reader };

        Ok(source)
    }

    fn read(&mut self, len: usize) -> Result<Vec<u8>, SourceError> {
        //TODO AAZ: Remove unsafe code if this binary will not used for benchmarking.
        // Initialize a vector with the given length to use as buffer for reading from the file
        let mut buf = Vec::with_capacity(len);

        // SAFETY: truncate is called on the buffer after read call with the read amount of bytes.
        // Even with unwind after panic, this shouldn't cause undefined behavior since the vector has only bytes which
        // don't have a special drop implementation.
        unsafe {
            buf.set_len(len);
        }

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
