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
    plugins_manager::paths::extract_plugin_file_paths, plugins_shared::plugin_errors::PluginError,
    PluginHostInitError, PluginType, PluginsByteSource, PluginsParser,
};

use super::{
    cache::{self, CacheManager},
    paths, InitError, PluginEntity,
};

/// Loads all plugins from the plugin directory while using the provided `cache_manager`
/// for unchanged plugins and updating it with newly loaded ones.
///
/// # Note:
///
/// This function does not call `persist` on cache updates during loading to avoid
/// unnecessary deserialization and disk writes for each loaded plugin.
///
/// # Returns:
///
/// List of valid plugins alongside with other list for invalid ones.
pub async fn load_all_plugins(
    cache_manager: &mut CacheManager,
) -> Result<(Vec<ExtendedPluginEntity>, Vec<ExtendedInvalidPluginEntity>), InitError> {
    let plugins_dir = paths::plugins_dir().ok_or_else(home_dir_err)?;
    if !plugins_dir.exists() {
        log::trace!("Plugins directory doesn't exist. Creating it...");
        fs::create_dir_all(plugins_dir)?;
    }

    let (mut valid_plugins, mut invalid_plugs) =
        load_plugins(PluginType::Parser, cache_manager).await?;

    let (valid_sources, invalid_soruces) =
        load_plugins(PluginType::ByteSource, cache_manager).await?;

    valid_plugins.extend(valid_sources);
    invalid_plugs.extend(invalid_soruces);

    Ok((valid_plugins, invalid_plugs))
}

fn home_dir_err() -> InitError {
    InitError::Other(String::from("Failed to find home directory"))
}

/// Loads all plugins from the main directory of the provided plugin type.
///
/// # Returns:
///
/// List of valid plugins alongside with other list for invalid ones.
async fn load_plugins(
    plug_type: PluginType,
    cache_manager: &mut CacheManager,
) -> Result<(Vec<ExtendedPluginEntity>, Vec<ExtendedInvalidPluginEntity>), InitError> {
    let mut valid_plugins = Vec::new();
    let mut invalid_plugins = Vec::new();

    let plugins_dir = match plug_type {
        PluginType::Parser => paths::parser_dir().ok_or_else(home_dir_err)?,
        PluginType::ByteSource => paths::bytesource_dir().ok_or_else(home_dir_err)?,
    };

    if !plugins_dir.exists() {
        log::trace!("{plug_type} directory doesn't exist. Creating it...");
        fs::create_dir_all(plugins_dir)?;

        return Ok((valid_plugins, invalid_plugins));
    }

    for dir in get_dirs(&plugins_dir)? {
        match load_plugin(dir, plug_type, cache_manager).await? {
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
    cache_manager: &mut CacheManager,
) -> Result<PluginEntityState, InitError> {
    let mut rd = PluginRunData::default();
    rd.info("Attempt to load and check plugin");
    let (wasm_file, metadata_file, readme_path) = match validate_plugin_files(&plug_dir)? {
        PluginValidationState::Valid {
            wasm_path,
            metadata_file,
            readme_file,
        } => (wasm_path, metadata_file, readme_file),
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

    let plug_info = if let Some(plugin_state) = cache_manager.get_plugin_cache(&plug_dir)? {
        rd.info("Reading plugin info from cache");
        match plugin_state {
            super::cache::CachedPluginState::Installed(plugin_info) => plugin_info,
            super::cache::CachedPluginState::Invalid(err_msg) => {
                rd.err(format!(
                    "Plugin binary failed to load in the last attempt, according to cached data. \
                    Error: {err_msg}"
                ));
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
        }
    } else {
        let plug_info_res = match plug_type {
            PluginType::Parser => PluginsParser::get_info(wasm_file).await,
            PluginType::ByteSource => PluginsByteSource::get_info(wasm_file).await,
        };

        match plug_info_res {
            Ok(info) => {
                cache_manager.update_plugin(
                    &plug_dir,
                    cache::CachedPluginState::Installed(info.clone()),
                    false,
                )?;
                info
            }
            // Stop the whole loading on engine errors
            Err(PluginError::HostInitError(PluginHostInitError::EngineError(err))) => {
                return Err(err.into())
            }
            Err(err) => {
                let err_msg = format!("Loading plugin binary fail. Error: {err}");
                rd.err(&err_msg);
                cache_manager.update_plugin(
                    &plug_dir,
                    cache::CachedPluginState::Invalid(err_msg),
                    false,
                )?;
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
        metadata_file: Option<PathBuf>,
        /// Path for plugin README markdown file.
        readme_file: Option<PathBuf>,
    },
    /// Represents an invalid plugin with infos about validation error.
    Invalid {
        /// Error message explaining why the plugin is invalid.
        err_msg: String,
    },
}

/// Loads plugin files inside its directory and validate their content returning the state
/// of the plugin.
///
/// * `plugin_dir`: Path for the plugin directory.
fn validate_plugin_files(plugin_dir: &Path) -> Result<PluginValidationState, InitError> {
    use PluginValidationState as Re;

    let plugin_files = extract_plugin_file_paths(plugin_dir).ok_or_else(|| {
        InitError::Other(format!(
            "Extracting plugins files from its directory failed. Plugin directory: {}",
            plugin_dir.display()
        ))
    })?;

    let wasm_path = if plugin_files.wasm_file.exists() {
        plugin_files.wasm_file
    } else {
        let err_msg = format!(
            "Plugin WASM file not found. Path {}",
            plugin_files.wasm_file.display()
        );

        return Ok(Re::Invalid { err_msg });
    };

    let metadata_file = plugin_files
        .metadata_file
        .exists()
        .then_some(plugin_files.metadata_file);

    let readme_file = plugin_files
        .readme_file
        .exists()
        .then_some(plugin_files.readme_file);

    let res = Re::Valid {
        wasm_path,
        metadata_file,
        readme_file,
    };

    Ok(res)
}

/// Parser the plugin metadata from the provided toml file.
fn parse_metadata(file: &PathBuf) -> Result<PluginMetadata, String> {
    let content = read_to_string(file)
        .map_err(|err| format!("Reading metadata file fail. Error {err:#?}"))?;

    toml::from_str(&content).map_err(|err| format!("Parsing metadata file fail. Error {err:#?}"))
}
