use stypes::{
    ParserRenderOptions, PluginInfo, PluginMetadata, PluginType, RenderOptions, SemanticVersion,
};

use super::*;

const PARSER_PATH_1: &str = "parser_1";
const PARSER_PATH_2: &str = "parser_2";
const SOURCE_PATH_1: &str = "source_1";
const SOURCE_PATH_2: &str = "source_2";
const PARSER_README_PATH: &str = "parser_1/README.md";
const SOURCE_README_PATH: &str = "source_1/README.md";

const INV_PARSER_PATH: &str = "inv_parse";
const INV_SOURCE_PATH: &str = "inv_soruce";

/// Provide manager mock to test it's API
fn create_manager() -> PluginsManager {
    let installed_plugins: Vec<ExtendedPluginEntity> = vec![
        PluginEntity {
            dir_path: PARSER_PATH_1.into(),
            plugin_type: PluginType::Parser,
            info: PluginInfo {
                wasm_file_path: "path".into(),
                api_version: SemanticVersion::new(0, 1, 0),
                plugin_version: SemanticVersion::new(0, 1, 0),
                config_schemas: Vec::new(),
                render_options: RenderOptions::Parser(Box::new(ParserRenderOptions {
                    columns_options: None,
                })),
            },
            metadata: PluginMetadata {
                title: "parser_1".into(),
                description: None,
            },
            readme_path: Some(PARSER_README_PATH.into()),
        }
        .into(),
        PluginEntity {
            dir_path: PARSER_PATH_2.into(),
            plugin_type: PluginType::Parser,
            info: PluginInfo {
                wasm_file_path: "path".into(),
                api_version: SemanticVersion::new(0, 1, 0),
                plugin_version: SemanticVersion::new(0, 1, 0),
                config_schemas: Vec::new(),
                render_options: RenderOptions::Parser(Box::new(ParserRenderOptions {
                    columns_options: None,
                })),
            },
            metadata: PluginMetadata {
                title: "parser_2".into(),
                description: None,
            },
            readme_path: None,
        }
        .into(),
        PluginEntity {
            dir_path: SOURCE_PATH_1.into(),
            plugin_type: PluginType::ByteSource,
            info: PluginInfo {
                wasm_file_path: "path".into(),
                api_version: SemanticVersion::new(0, 1, 0),
                plugin_version: SemanticVersion::new(0, 1, 0),
                config_schemas: Vec::new(),
                render_options: RenderOptions::ByteSource,
            },
            metadata: PluginMetadata {
                title: "source_1".into(),
                description: None,
            },
            readme_path: Some(SOURCE_README_PATH.into()),
        }
        .into(),
        PluginEntity {
            dir_path: SOURCE_PATH_2.into(),
            plugin_type: PluginType::ByteSource,
            info: PluginInfo {
                wasm_file_path: "path".into(),
                api_version: SemanticVersion::new(0, 1, 0),
                plugin_version: SemanticVersion::new(0, 1, 0),
                config_schemas: Vec::new(),
                render_options: RenderOptions::ByteSource,
            },
            metadata: PluginMetadata {
                title: "source_2".into(),
                description: None,
            },
            readme_path: None,
        }
        .into(),
    ];

    let mut invalid_plugins: Vec<ExtendedInvalidPluginEntity> = vec![
        InvalidPluginEntity::new(INV_PARSER_PATH.into(), PluginType::Parser).into(),
        InvalidPluginEntity::new(INV_SOURCE_PATH.into(), PluginType::ByteSource).into(),
    ];
    invalid_plugins[0].run_data.err("error");
    invalid_plugins[1].run_data.err("error");

    PluginsManager {
        cache_manager: Default::default(),
        installed_plugins,
        invalid_plugins,
    }
}

#[test]
fn test_installed_api() {
    let manager = create_manager();

    let installed: Vec<&PluginEntity> = manager.installed_plugins().collect();
    assert_eq!(installed.len(), 4);
    assert_eq!(installed[0].dir_path, PathBuf::from(PARSER_PATH_1));
    assert_eq!(
        installed[0].readme_path,
        Some(PathBuf::from(PARSER_README_PATH))
    );
    assert_eq!(installed[1].dir_path, PathBuf::from(PARSER_PATH_2));
    assert_eq!(installed[2].dir_path, PathBuf::from(SOURCE_PATH_1));
    assert_eq!(
        installed[2].readme_path,
        Some(PathBuf::from(SOURCE_README_PATH))
    );
    assert_eq!(installed[3].dir_path, PathBuf::from(SOURCE_PATH_2));

    let mut paths = manager.installed_plugins_paths();
    assert_eq!(paths.next().unwrap(), &PathBuf::from(PARSER_PATH_1));
    assert_eq!(paths.next().unwrap(), &PathBuf::from(PARSER_PATH_2));
    assert_eq!(paths.next().unwrap(), &PathBuf::from(SOURCE_PATH_1));
    assert_eq!(paths.next().unwrap(), &PathBuf::from(SOURCE_PATH_2));
    assert!(paths.next().is_none());

    let parser_1 = manager
        .get_installed_plugin(&PathBuf::from(PARSER_PATH_1))
        .unwrap();
    assert_eq!(parser_1.dir_path, PathBuf::from(PARSER_PATH_1));
    assert_eq!(
        parser_1.readme_path,
        Some(PathBuf::from(PARSER_README_PATH))
    );
}

#[test]
fn test_inavlid_api() {
    let manager = create_manager();

    let invalid: Vec<&InvalidPluginEntity> = manager.invalid_plugins().collect();
    assert_eq!(invalid.len(), 2);
    assert_eq!(invalid[0].dir_path, PathBuf::from(INV_PARSER_PATH));
    assert_eq!(invalid[1].dir_path, PathBuf::from(INV_SOURCE_PATH));

    let mut inv_paths = manager.invalid_plugins_paths();
    assert_eq!(inv_paths.next().unwrap(), &PathBuf::from(INV_PARSER_PATH));
    assert_eq!(inv_paths.next().unwrap(), &PathBuf::from(INV_SOURCE_PATH));
    assert!(inv_paths.next().is_none());

    let inv_parser = manager
        .get_invalid_plugin(&PathBuf::from(INV_PARSER_PATH))
        .unwrap();
    assert_eq!(inv_parser.dir_path, PathBuf::from(INV_PARSER_PATH));
}
