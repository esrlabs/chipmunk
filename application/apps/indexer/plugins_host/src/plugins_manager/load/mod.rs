mod paths;

use std::{
    fs::{self, read_to_string},
    io,
    path::PathBuf,
};

use crate::{
    plugins_manager::{InvalidPluginInfo, PluginState},
    PluginType, PluginsParser,
};

use super::{InitError, PluginEntity, PluginMetadata};

/// Loads all the plugins from the plugin directory
pub async fn load_plugins() -> Result<Vec<PluginEntity>, InitError> {
    let plugins_dir = paths::plugins_dir()?;
    if !plugins_dir.exists() {
        log::trace!("Plugins directory doens't exist");
        return Ok(Vec::new());
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
        log::trace!("Parsers directory deosn't exist");

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
        .into_iter()
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| path.is_dir());

    Ok(dirs)
}

async fn load_parser(dir: PathBuf) -> Result<PluginEntity, InitError> {
    let mut wasm_file = None;
    let mut metadata_file = None;
    let mut error_msg = None;
    for file in fs::read_dir(&dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|e| e.is_file())
    {
        match file.extension().map(|ext| ext.to_str()) {
            Some(Some("wasm")) => {
                if wasm_file.replace(file).is_some() {
                    error_msg = Some(format!("Multiple wasm files found in {}", dir.display()));

                    break;
                }
            }
            Some(Some("toml")) => {
                if metadata_file.replace(file).is_some() {
                    error_msg = Some(format!(
                        "Multiple metadata files found in {}",
                        dir.display()
                    ));

                    break;
                }
            }
            _invalid => {
                log::warn!(
                    "File ignored while loading parser plugin. Path {}",
                    file.display()
                );
            }
        }
    }

    if let Some(err_msg) = error_msg {
        let invaid_entity = PluginEntity {
            dir_path: dir,
            plugin_type: PluginType::Parser,
            state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
            metadata: None,
        };
        return Ok(invaid_entity);
    }

    let wasm_file = match wasm_file {
        Some(file) => file,
        None => {
            let err_msg = format!("No *.wasm file found in {}", dir.display());
            let invalid_entity = PluginEntity {
                dir_path: dir,
                plugin_type: PluginType::Parser,
                state: PluginState::Invalid(Box::new(InvalidPluginInfo::new(err_msg))),
                metadata: None,
            };
            return Ok(invalid_entity);
        }
    };

    let plugin_info = match PluginsParser::get_info(&wasm_file).await {
        Ok(info) => info,
        Err(err) => {
            let err_msg = format!("Loading plugin binray fail. Error: {err}");
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

fn parse_metadata(file: &PathBuf) -> Result<PluginMetadata, String> {
    let content = read_to_string(file)
        .map_err(|err| format!("Reading metadata file fail. Error {err:#?}"))?;

    toml::from_str(&content).map_err(|err| format!("Parsing metadata file fail. Error {err:#?}"))
}

async fn load_all_bytesources() -> Result<Vec<PluginEntity>, InitError> {
    return Ok(Vec::new());

    // TODO AAZ: Activate when implementing byte source
    //
    // let mut bytesources = Vec::new();
    //
    // let bytesource_dir = paths::bytesource_dir()?;
    // if !bytesource_dir.exists() {
    //     log::trace!("Bytesources directory doesn't exist");
    //     return Ok(bytesources);
    // }
    //
    // for dir in get_dirs(&bytesource_dir)? {
    //     let source = load_bytesource(&dir)?;
    //     bytesources.push(source);
    // }
    //
    // Ok(bytesources)
}

#[allow(unused)]
fn load_bytesource(dir: &PathBuf) -> Result<PluginEntity, InitError> {
    todo!()
}
