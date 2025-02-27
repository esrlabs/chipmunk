mod paths;

use std::{
    fs::{self, read_to_string},
    io,
    path::{Path, PathBuf},
};

use stypes::{
    ExtendedInvalidPluginEntity, ExtendedPluginEntity, InvalidPluginEntity, PluginMetadata,
    PluginRunData,
};

use crate::{
    plugins_shared::plugin_errors::PluginError, PluginHostInitError, PluginType, PluginsByteSource,
    PluginsParser,
};

use super::{InitError, PluginEntity};

pub const PLUGIN_README_FILENAME: &str = "README.md";

/// Loads all the plugins from the plugin directory
///
/// # Returns:
///
/// List of valid plugins alongside with other list for invalid ones.
pub async fn load_all_plugins(
) -> Result<(Vec<ExtendedPluginEntity>, Vec<ExtendedInvalidPluginEntity>), InitError> {
    let plugins_dir = paths::plugins_dir()?;
    if !plugins_dir.exists() {
        log::trace!("Plugins directory doesn't exist. Creating it...");
        fs::create_dir_all(plugins_dir)?;
    }

    let (mut valid_plugins, mut invalid_plugs) = load_plugins(PluginType::Parser).await?;

    let (valid_sources, invalid_soruces) = load_plugins(PluginType::ByteSource).await?;

    valid_plugins.extend(valid_sources);
    invalid_plugs.extend(invalid_soruces);

    Ok((valid_plugins, invalid_plugs))
}

/// Loads all plugins from the main directory of the provided plugin type.
///
/// # Returns:
///
/// List of valid plugins alongside with other list for invalid ones.
async fn load_plugins(
    plug_type: PluginType,
) -> Result<(Vec<ExtendedPluginEntity>, Vec<ExtendedInvalidPluginEntity>), InitError> {
    let mut valid_plugins = Vec::new();
    let mut invalid_plugins = Vec::new();

    let plugins_dir = match plug_type {
        PluginType::Parser => paths::parser_dir()?,
        PluginType::ByteSource => paths::bytesource_dir()?,
    };

    if !plugins_dir.exists() {
        log::trace!("{plug_type} directory doesn't exist. Creating it...");
        fs::create_dir_all(plugins_dir)?;

        return Ok((valid_plugins, invalid_plugins));
    }

    for dir in get_dirs(&plugins_dir)? {
        match load_plugin(dir, plug_type).await? {
            PluginEntityState::Valid(plugin) => valid_plugins.push(plugin),
            PluginEntityState::Invalid(invalid) => invalid_plugins.push(invalid),
        }
    }

    Ok((valid_plugins, invalid_plugins))
}

/// Represents the various states of a plugin entity.
/// This type is used internally in this module only.
enum PluginEntityState {
    Valid(ExtendedPluginEntity),
    Invalid(ExtendedInvalidPluginEntity),
}

/// Loads plugin infos and metadata from the provided plugin directory.
///
/// * `plug_dir`: Plugin directory
/// * `plug_type`: Plugin Type
///
/// # Returns:
///
/// Plugins infos and metadata when valid, or error infos when invalid.
async fn load_plugin(
    plug_dir: PathBuf,
    plug_type: PluginType,
) -> Result<PluginEntityState, InitError> {
    let mut rd = PluginRunData::default();
    rd.info("Attempt to load and check plugin");
    let (wasm_file, metadata_file) = match validate_plugin_files(&plug_dir)? {
        PluginValidationState::Valid {
            wasm_path: wasm,
            metadata,
        } => (wasm, metadata),
        PluginValidationState::Invalid { err_msg } => {
            rd.err(err_msg);
            return Ok(PluginEntityState::Invalid(
                ExtendedInvalidPluginEntity::new(
                    InvalidPluginEntity {
                        dir_path: plug_dir,
                        plugin_type: plug_type,
                    },
                    rd,
                ),
            ));
        }
    };

    let plug_info_res = match plug_type {
        PluginType::Parser => PluginsParser::get_info(wasm_file).await,
        PluginType::ByteSource => PluginsByteSource::get_info(wasm_file).await,
    };

    let plug_info = match plug_info_res {
        Ok(info) => info,
        // Stop the whole loading on engine errors
        Err(PluginError::HostInitError(PluginHostInitError::EngineError(err))) => {
            return Err(err.into())
        }
        Err(err) => {
            rd.err(format!("Loading plugin binary fail. Error: {err}"));
            return Ok(PluginEntityState::Invalid(
                ExtendedInvalidPluginEntity::new(
                    InvalidPluginEntity {
                        dir_path: plug_dir,
                        plugin_type: plug_type,
                    },
                    rd,
                ),
            ));
        }
    };

    let plug_metadata = match metadata_file {
        Some(file) => match parse_metadata(&file) {
            Ok(metadata) => {
                rd.info("Metadata file found and load");
                metadata
            }
            Err(err_msg) => {
                rd.err(format!(
                    "Parsing metadata file failed with error: {err_msg}"
                ));
                let dir_name = plug_dir
                    .file_name()
                    .and_then(|p| p.to_str())
                    .unwrap_or("Unknown");

                PluginMetadata {
                    name: dir_name.into(),
                    description: None,
                }
            }
        },
        None => {
            rd.warn("Metadata file not found");
            let dir_name = plug_dir
                .file_name()
                .and_then(|p| p.to_str())
                .unwrap_or("Unknown");

            PluginMetadata {
                name: dir_name.into(),
                description: None,
            }
        }
    };

    let readme = plug_dir.join(PLUGIN_README_FILENAME);
    let readme_path = if readme.exists() {
        rd.info("README file found");
        Some(readme)
    } else {
        rd.warn("README file not found");
        None
    };

    rd.info("Plugin has been load, checked and accepted");
    Ok(PluginEntityState::Valid(ExtendedPluginEntity::new(
        PluginEntity {
            dir_path: plug_dir,
            plugin_type: plug_type,
            info: plug_info,
            metadata: plug_metadata,
            readme_path,
        },
        rd,
    )))
}

/// Retrieves all directory form the given directory path
fn get_dirs(dir_path: &PathBuf) -> Result<impl Iterator<Item = PathBuf>, io::Error> {
    let dirs = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir());

    Ok(dirs)
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
