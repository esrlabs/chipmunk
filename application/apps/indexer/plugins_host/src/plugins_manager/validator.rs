//! Module to provide various validation for plugin files, configurations and metadata.
//! It validates plugin files and ensure plugins configurations and metadata are valid and
//! don't contain malicious texts.

use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

use stypes::{ColumnsRenderOptions, PluginInfo, PluginMetadata, RenderOptions};

use crate::plugins_manager::paths::extract_plugin_file_paths;

use super::PluginsManagerError;

/// Maximum length for configuration IDs before considered malicious.
const MAX_ID_TEXT_LENGTH: usize = 1024;

/// Maximum length for title texts before considered malicious.
const MAX_TITLE_TEXT_LENGTH: usize = 2 * 1024;

/// Maximum length for description texts before considered malicious.
const MAX_DESCRIPTION_TEXT_LENGTH: usize = 10 * 1024;

/// Maximum length of collections provided by plugins before considered malicious.
const MAX_COLLECTIONS_LENGTH: usize = 100;

/// Scans and validates the plugin directory, ensuring all required files exist  
/// and collecting paths of relevant plugin-related files (both mandatory and optional).
///
/// * `plugin_dir`: Path for the plugin directory.
pub fn validate_plugin_files(plugin_dir: &Path) -> Result<PluginFilesStatus, PluginsManagerError> {
    use PluginFilesStatus as Re;

    if !plugin_dir.exists() {
        let err_msg = format!(
            "Plugin directory doesn't exist. Path: {}",
            plugin_dir.display()
        );
        return Ok(Re::Invalid { err_msg });
    }

    let Some(plugin_files) = extract_plugin_file_paths(plugin_dir) else {
        let err_msg = format!(
            "Extracting plugins files from its directory failed. Plugin directory: {}",
            plugin_dir.display()
        );
        return Ok(Re::Invalid { err_msg });
    };

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

/// Represents the result of scanning a plugin directory,  
/// providing details about detected files and validation status.
#[derive(Debug, Clone)]
pub enum PluginFilesStatus {
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

/// Validates the provided plugin info against invalid or malicious infos.
pub fn validate_plugin_info(info: &PluginInfo) -> Result<(), String> {
    // Note: Pattern match is reminder to validate newly added items.
    let PluginInfo {
        wasm_file_path: _,
        api_version: _,
        plugin_version: _,
        config_schemas,
        render_options,
    } = info;

    if config_schemas.len() > MAX_COLLECTIONS_LENGTH {
        return Err(format!(
            "Configurations Schema items count is greater than {MAX_COLLECTIONS_LENGTH}"
        ));
    }

    let mut id_sets = HashSet::with_capacity(config_schemas.len());

    for conf in config_schemas {
        if conf.id.len() > MAX_ID_TEXT_LENGTH {
            return Err(format!(
                "Configuration ID is longer than {MAX_ID_TEXT_LENGTH} bytes"
            ));
        }

        if !id_sets.insert(conf.id.as_str()) {
            return Err(format!("Configuration ID '{}' is duplicated", conf.id));
        }

        if conf.title.len() > MAX_TITLE_TEXT_LENGTH {
            return Err(format!(
                "Configuration title is longer than {MAX_TITLE_TEXT_LENGTH} bytes"
            ));
        }
        if conf
            .description
            .as_ref()
            .is_some_and(|desc| desc.len() > MAX_DESCRIPTION_TEXT_LENGTH)
        {
            return Err(format!(
                "Configuration description is longer than {MAX_DESCRIPTION_TEXT_LENGTH} bytes"
            ));
        }
    }

    match render_options {
        RenderOptions::Parser(parser_render_options) => {
            if let Some(columns_opts) = parser_render_options.columns_options.as_ref() {
                let ColumnsRenderOptions {
                    columns,
                    min_width: _,
                    max_width: _,
                } = columns_opts;

                if columns.len() > MAX_COLLECTIONS_LENGTH {
                    return Err(format!(
                        "Columns info items count in render options is greater than {MAX_COLLECTIONS_LENGTH}"
                    ));
                }

                for col in columns {
                    if col.caption.len() > MAX_TITLE_TEXT_LENGTH {
                        return Err(format!(
                            "Column caption in render options is longer than {MAX_TITLE_TEXT_LENGTH} bytes"
                        ));
                    }
                    if col.description.len() > MAX_DESCRIPTION_TEXT_LENGTH {
                        return Err(format!(
                            "Column description in render options is longer than {MAX_DESCRIPTION_TEXT_LENGTH}"
                        ));
                    }
                }
            }
        }
        RenderOptions::ByteSource => {}
    }

    Ok(())
}

pub fn validate_plugins_metadata(metadata: &PluginMetadata) -> Result<(), String> {
    // Note: Pattern match is reminder to validate newly added items.
    let PluginMetadata { title, description } = metadata;

    if title.len() > MAX_TITLE_TEXT_LENGTH {
        return Err(format!(
            "Plugin Title is longer than {MAX_TITLE_TEXT_LENGTH} bytes"
        ));
    }

    if description
        .as_ref()
        .is_some_and(|desc| desc.len() > MAX_DESCRIPTION_TEXT_LENGTH)
    {
        return Err(format!(
            "Plugin description is longer than {MAX_DESCRIPTION_TEXT_LENGTH} bytes"
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use stypes::{
        ColumnInfo, ColumnsRenderOptions, PluginConfigSchemaItem, PluginConfigSchemaType,
        SemanticVersion,
    };

    use super::*;

    fn version() -> SemanticVersion {
        SemanticVersion::new(0, 1, 0)
    }

    #[test]
    fn valid_configs_pass() {
        let valid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![
                PluginConfigSchemaItem::new(
                    "id",
                    "title",
                    Some("description"),
                    PluginConfigSchemaType::Boolean(false),
                ),
                PluginConfigSchemaItem::new(
                    "id_2",
                    "title_2",
                    None,
                    PluginConfigSchemaType::Boolean(true),
                ),
            ],

            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: None,
            })),
        };

        assert!(validate_plugin_info(&valid_info).is_ok());
    }

    #[test]
    fn valid_render_pass() {
        let valid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![],
            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: Some(ColumnsRenderOptions {
                    columns: vec![
                        ColumnInfo {
                            caption: String::from("Caption_1"),
                            description: String::from("Description_1"),
                            width: 12,
                        },
                        ColumnInfo {
                            caption: String::from("Caption_2"),
                            description: String::from("Description_2"),
                            width: 16,
                        },
                    ],
                    min_width: 0,
                    max_width: 10,
                }),
            })),
        };

        assert!(validate_plugin_info(&valid_info).is_ok());
    }

    #[test]
    fn duplicated_configs_id_fail() {
        let id = "same id";

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![
                PluginConfigSchemaItem::new(
                    id,
                    "title",
                    Some("description"),
                    PluginConfigSchemaType::Boolean(false),
                ),
                PluginConfigSchemaItem::new(
                    id,
                    "title_2",
                    Some("description_2"),
                    PluginConfigSchemaType::Boolean(true),
                ),
            ],

            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: None,
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn invalid_configs_count_fail() {
        let mut configs = Vec::with_capacity(MAX_COLLECTIONS_LENGTH + 1);
        for id in 0..MAX_COLLECTIONS_LENGTH + 1 {
            configs.push(PluginConfigSchemaItem::new(
                format!("ID_{id}"),
                "title".into(),
                Some("description".into()),
                PluginConfigSchemaType::Boolean(false),
            ));
        }

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: configs,

            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: None,
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    /// Provides a string longer that the provided limit
    fn get_too_long(limit: usize) -> String {
        "a".repeat(limit + 1)
    }

    #[test]
    fn invalid_configs_id_fail() {
        let id = get_too_long(MAX_ID_TEXT_LENGTH);

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![
                PluginConfigSchemaItem::new(
                    id.as_str(),
                    "title",
                    Some("description"),
                    PluginConfigSchemaType::Boolean(false),
                ),
                PluginConfigSchemaItem::new(
                    "id_2",
                    "title_2",
                    Some("description_2"),
                    PluginConfigSchemaType::Boolean(true),
                ),
            ],

            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: None,
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn invalid_configs_title_fail() {
        let title = get_too_long(MAX_TITLE_TEXT_LENGTH);

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![
                PluginConfigSchemaItem::new(
                    "id",
                    title.as_str(),
                    Some("description"),
                    PluginConfigSchemaType::Boolean(false),
                ),
                PluginConfigSchemaItem::new(
                    "id_2",
                    "title_2",
                    Some("description_2"),
                    PluginConfigSchemaType::Boolean(true),
                ),
            ],

            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: None,
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn invalid_configs_desc_fail() {
        let description = get_too_long(MAX_DESCRIPTION_TEXT_LENGTH);

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![
                PluginConfigSchemaItem::new(
                    "id",
                    "title",
                    Some(description.as_str()),
                    PluginConfigSchemaType::Boolean(false),
                ),
                PluginConfigSchemaItem::new(
                    "id_2",
                    "title_2",
                    Some("description_2"),
                    PluginConfigSchemaType::Boolean(true),
                ),
            ],

            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: None,
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn invalid_columns_len_fail() {
        let column = ColumnInfo {
            caption: String::from("c"),
            description: String::from("d"),
            width: 12,
        };

        let columns = vec![column; MAX_COLLECTIONS_LENGTH + 1];

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![],
            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: Some(ColumnsRenderOptions {
                    columns,
                    min_width: 0,
                    max_width: 10,
                }),
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn invalid_column_caption_fail() {
        let caption = get_too_long(MAX_TITLE_TEXT_LENGTH);

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![],
            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: Some(ColumnsRenderOptions {
                    columns: vec![
                        ColumnInfo {
                            caption,
                            description: String::from("Description_1"),
                            width: 12,
                        },
                        ColumnInfo {
                            caption: String::from("Caption_2"),
                            description: String::from("Description_2"),
                            width: 16,
                        },
                    ],
                    min_width: 0,
                    max_width: 10,
                }),
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn invalid_column_description_fail() {
        let description = get_too_long(MAX_DESCRIPTION_TEXT_LENGTH);

        let invalid_info = PluginInfo {
            wasm_file_path: Default::default(),
            api_version: version(),
            plugin_version: version(),
            config_schemas: vec![],
            render_options: RenderOptions::Parser(Box::new(stypes::ParserRenderOptions {
                columns_options: Some(ColumnsRenderOptions {
                    columns: vec![
                        ColumnInfo {
                            caption: String::from("Caption_1"),
                            description,
                            width: 12,
                        },
                        ColumnInfo {
                            caption: String::from("Caption_2"),
                            description: String::from("Description_2"),
                            width: 16,
                        },
                    ],
                    min_width: 0,
                    max_width: 10,
                }),
            })),
        };

        assert!(validate_plugin_info(&invalid_info).is_err());
    }

    #[test]
    fn valid_metadata_pass() {
        let valid_meta = PluginMetadata {
            title: String::from("Title_1"),
            description: Some(String::from("Description_1")),
        };

        assert!(validate_plugins_metadata(&valid_meta).is_ok());

        let valid_meta = PluginMetadata {
            title: String::from("Title_1"),
            description: None,
        };

        assert!(validate_plugins_metadata(&valid_meta).is_ok());
    }

    #[test]
    fn invalid_metadata_title_fail() {
        let title = get_too_long(MAX_TITLE_TEXT_LENGTH);
        let invalid_meta = PluginMetadata {
            title,
            description: Some(String::from("Description_1")),
        };

        assert!(validate_plugins_metadata(&invalid_meta).is_err());
    }

    #[test]
    fn invalid_metadata_description_fail() {
        let description = get_too_long(MAX_DESCRIPTION_TEXT_LENGTH);
        let invalid_meta = PluginMetadata {
            title: String::from("Title_1"),
            description: Some(description),
        };

        assert!(validate_plugins_metadata(&invalid_meta).is_err());
    }
}
