mod paths;

use std::{
    fs::{self, read_to_string},
    io,
    path::{Path, PathBuf},
};

use stypes::{InvalidPluginInfo, PluginMetadata};

use crate::{
    plugins_manager::PluginState, plugins_shared::plugin_errors::PluginError, PluginHostInitError,
    PluginType, PluginsByteSource, PluginsParser,
};

use super::{InitError, PluginEntity};

/// Loads all the plugins from the plugin directory
pub async fn load_plugins() -> Result<Vec<PluginEntity>, InitError> {
    let plugins_dir = paths::plugins_dir()?;
    if !plugins_dir.exists() {
        log::trace!("Plugins directory doesn't exist. Creating it...");
        fs::create_dir_all(plugins_dir)?;
    }

    let mut plugins = load_all_parsers().await?;

    let bytesources = load_all_bytesources().await?;

    plugins.extend(bytesources);

    Ok(plugins)
}

/// Loads all parser plugins from their directory.
async fn load_all_parsers() -> Result<Vec<PluginEntity>, InitError> {
    let mut parsers = Vec::new();

    let parsers_dir = paths::parser_dir()?;
    if !parsers_dir.exists() {
        log::trace!("Parsers directory doesn't exist. Creating it ...");
        fs::create_dir_all(&parsers_dir)?;

        return Ok(parsers);
    }

    for dir in get_dirs(&parsers_dir)? {
        let parser = load_parser(dir).await?;
        parsers.push(parser);
    }

    Ok(parsers)
}

/// Retrieves all directory form the given directory path
fn get_dirs(dir_path: &PathBuf) -> Result<impl Iterator<Item = PathBuf>, io::Error> {
    let dirs = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir());

    Ok(dirs)
}

/// Loads parser infos and metadata from the provided parser directory.
async fn load_parser(dir: PathBuf) -> Result<PluginEntity, InitError> {
    let (wasm_file, metadata_file) = match validate_plugin_files(&dir)? {
        PluginValidationState::Valid {
            wasm_path: wasm,
            metadata,
        } => (wasm, metadata),
        PluginValidationState::Invalid { err_msg } => {
            let invalid_entity = PluginEntity {
                dir_path: dir,
                plugin_type: PluginType::Parser,
                state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                metadata: None,
            };

            return Ok(invalid_entity);
        }
    };

    let plugin_info = match PluginsParser::get_info(wasm_file).await {
        Ok(info) => info,
        // Stop the whole loading on engine errors
        Err(PluginError::HostInitError(PluginHostInitError::EngineError(err))) => {
            return Err(err.into())
        }
        Err(err) => {
            let err_msg = format!("Loading plugin binary fail. Error: {err}");
            let invalid = PluginEntity {
                dir_path: dir,
                plugin_type: PluginType::Parser,
                state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                metadata: None,
            };

            return Ok(invalid);
        }
    };

    let plugin_metadata = match metadata_file {
        Some(file) => {
            let metadata = match parse_metadata(&file) {
                Ok(metadata) => metadata,
                Err(err_msg) => {
                    let invalid_entity = PluginEntity {
                        dir_path: dir,
                        plugin_type: PluginType::Parser,
                        state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                        metadata: None,
                    };
                    return Ok(invalid_entity);
                }
            };

            Some(metadata)
        }
        None => None,
    };

    let valid_plugin = PluginEntity {
        dir_path: dir,
        plugin_type: PluginType::Parser,
        state: PluginState::Active(Box::new(plugin_info)),
        metadata: plugin_metadata,
    };

    Ok(valid_plugin)
}

/// Represents Plugins State and the corresponding infos.
#[derive(Debug, Clone)]
enum PluginValidationState {
    /// Represents valid plugin with its infos and metadata.
    Valid {
        /// The path for the plugin wasm file.
        wasm_path: PathBuf,
        /// Metadata of the plugins found in plugins metadata toml file.
        metadata: Option<PathBuf>,
    },
    /// Represents an invalid plugin with infos about validation error.
    Invalid {
        /// Error message explaining why the plugin is invalid.
        err_msg: String,
    },
}

/// Extract plugins binary filename and metadata filename from plugins directory
/// path by conventions.
/// The current conventions state the plugin filename and metadata must match
/// the directory name of the plugin itself and will be considered as plugin name.
///
/// * `plugins_dir`: The path of the plugin directory
///
/// # Returns:
///
/// A tuple contains the filename of the plugin binary `*.wasm` file and its
/// metadata `*.toml` file when plugins directory is valid.
fn extract_plugin_filenames(plugins_dir: &Path) -> Result<(String, String), InitError> {
    let dir_name = plugins_dir
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            InitError::Other(format!(
                "Extracting plugins files from its directory failed. Plugin directory: {}",
                plugins_dir.display()
            ))
        })?;

    let plugin_file = format!("{dir_name}.wasm");
    let metadata_file = format!("{dir_name}.toml");

    Ok((plugin_file, metadata_file))
}

/// Loads plugin files inside its directory and validate their content returning the state
/// of the plugin.
///
/// * `plugin_dir`: Path for the plugin directory.
fn validate_plugin_files(plugin_dir: &PathBuf) -> Result<PluginValidationState, InitError> {
    use PluginValidationState as Re;

    let (plugin_filename, metadata_filename) = extract_plugin_filenames(plugin_dir)?;

    let mut wasm_file = None;
    let mut metadata_file = None;
    for file in fs::read_dir(plugin_dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|e| e.is_file())
    {
        match file.file_name().and_then(|name| name.to_str()) {
            Some(name) if name == plugin_filename => {
                wasm_file = Some(file);
            }
            Some(name) if name == metadata_filename => {
                metadata_file = Some(file);
            }
            _ignored => {
                log::info!(
                    "File ignored while loading parser plugin. Path {}",
                    file.display()
                );
            }
        }
    }

    let res = match wasm_file {
        Some(wasm) => Re::Valid {
            wasm_path: wasm,
            metadata: metadata_file,
        },
        None => {
            let err_msg = format!(
                "File {plugin_filename} is not found in {}",
                plugin_dir.display()
            );

            Re::Invalid { err_msg }
        }
    };

    Ok(res)
}

/// Parser the plugin metadata from the provided toml file.
fn parse_metadata(file: &PathBuf) -> Result<PluginMetadata, String> {
    let content = read_to_string(file)
        .map_err(|err| format!("Reading metadata file fail. Error {err:#?}"))?;

    toml::from_str(&content).map_err(|err| format!("Parsing metadata file fail. Error {err:#?}"))
}

/// Loads all byte-source plugins from their main directory.
async fn load_all_bytesources() -> Result<Vec<PluginEntity>, InitError> {
    let mut bytesources = Vec::new();

    let bytesource_dir = paths::bytesource_dir()?;
    if !bytesource_dir.exists() {
        log::trace!("Bytesources directory doesn't exist. Creating it ...");
        fs::create_dir_all(&bytesource_dir)?;

        return Ok(bytesources);
    }

    for dir in get_dirs(&bytesource_dir)? {
        let source = load_bytesource(dir).await?;
        bytesources.push(source);
    }

    Ok(bytesources)
}

/// Loads byte-source infos and metadata from the provided parser directory.
async fn load_bytesource(dir: PathBuf) -> Result<PluginEntity, InitError> {
    let (wasm_file, metadata_file) = match validate_plugin_files(&dir)? {
        PluginValidationState::Valid {
            wasm_path: wasm,
            metadata,
        } => (wasm, metadata),
        PluginValidationState::Invalid { err_msg } => {
            let invalid_entity = PluginEntity {
                dir_path: dir,
                plugin_type: PluginType::ByteSource,
                state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                metadata: None,
            };

            return Ok(invalid_entity);
        }
    };

    let plugin_info = match PluginsByteSource::get_info(wasm_file).await {
        Ok(info) => info,
        // Stop the whole loading on engine errors
        Err(PluginError::HostInitError(PluginHostInitError::EngineError(err))) => {
            return Err(err.into())
        }
        Err(err) => {
            let err_msg = format!("Loading plugin binary fail. Error: {err}");
            let invalid = PluginEntity {
                dir_path: dir,
                plugin_type: PluginType::ByteSource,
                state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                metadata: None,
            };

            return Ok(invalid);
        }
    };

    let plugin_metadata = match metadata_file {
        Some(file) => {
            let metadata = match parse_metadata(&file) {
                Ok(metadata) => metadata,
                Err(err_msg) => {
                    let invalid_entity = PluginEntity {
                        dir_path: dir,
                        plugin_type: PluginType::ByteSource,
                        state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                        metadata: None,
                    };
                    return Ok(invalid_entity);
                }
            };

            Some(metadata)
        }
        None => None,
    };

    let valid_plugin = PluginEntity {
        dir_path: dir,
        plugin_type: PluginType::ByteSource,
        state: PluginState::Active(Box::new(plugin_info)),
        metadata: plugin_metadata,
    };

    Ok(valid_plugin)
}
