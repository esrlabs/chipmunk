//! Recent-session validation for cleanup and user-triggered reopen flows.

use std::path::PathBuf;

use stypes::{ParserType, PluginType};
use thiserror::Error;

use crate::host::ui::state::plugin::PluginsState;

use super::session::{RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionSource};

/// Validation failure for reopening or cleaning up a recent-session snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum RecentValidationError {
    /// The snapshot has no source entries to reopen.
    #[error("Recent session has no sources.")]
    EmptySources,
    /// A file source referenced by the snapshot no longer exists.
    #[error("File is no longer available:\n{}", .0.display())]
    MissingFile(PathBuf),
    /// The saved plugin path cannot be mapped to a plugin directory.
    #[error("Parser plugin path is invalid:\n{}", .0.display())]
    PluginPathInvalid(PathBuf),
    /// Plugin loading has not finished yet.
    #[error(
        "Plugins are still loading. Try opening this recent session again after loading finishes."
    )]
    PluginManagerLoading,
    /// Plugin state is unavailable, so saved plugin settings cannot be checked.
    #[error("Plugin manager is unavailable. Reload plugins or remove this recent session.")]
    PluginManagerUnavailable,
    /// The saved parser plugin is not installed.
    #[error("Parser plugin is not installed:\n{}", .0.display())]
    PluginMissing(PathBuf),
    /// The saved parser plugin is installed but failed validation.
    #[error("Parser plugin is installed but invalid:\n{}", .0.display())]
    PluginInvalid(PathBuf),
    /// The saved plugin exists but is not a parser plugin.
    #[error("Plugin is not a parser plugin:\n{}", .0.display())]
    PluginNotParser(PathBuf),
}

/// Validates a user-triggered recent-session reopen request.
pub fn validate_reopen_request(
    snapshot: &RecentSessionSnapshot,
    mode: RecentSessionReopenMode,
    plugins: &PluginsState,
) -> Result<(), RecentValidationError> {
    validate_sources(snapshot)?;

    match mode {
        RecentSessionReopenMode::RestoreSession
        | RecentSessionReopenMode::RestoreParserConfiguration => {
            validate_saved_parser(snapshot, plugins)
        }
        RecentSessionReopenMode::OpenClean => Ok(()),
    }
}

/// Validates source availability without checking parser runtime availability.
pub fn validate_sources(snapshot: &RecentSessionSnapshot) -> Result<(), RecentValidationError> {
    if snapshot.sources().is_empty() {
        return Err(RecentValidationError::EmptySources);
    }

    for source in snapshot.sources() {
        match source {
            RecentSessionSource::File { path, .. } => {
                if !path.exists() {
                    return Err(RecentValidationError::MissingFile(path.clone()));
                }
            }
            RecentSessionSource::Stream { .. } => {}
        }
    }

    Ok(())
}

/// Validates saved parser settings that depend on runtime host state.
pub fn validate_saved_parser(
    snapshot: &RecentSessionSnapshot,
    plugins: &PluginsState,
) -> Result<(), RecentValidationError> {
    let settings = match &snapshot.parser {
        ParserType::Plugin(settings) => settings,
        ParserType::Dlt(_) | ParserType::SomeIp(_) | ParserType::Text(()) => return Ok(()),
    };

    let plugin_dir = settings
        .plugin_path
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .ok_or_else(|| RecentValidationError::PluginPathInvalid(settings.plugin_path.clone()))?;

    match plugins {
        PluginsState::Loading => Err(RecentValidationError::PluginManagerLoading),
        PluginsState::Unavailable => Err(RecentValidationError::PluginManagerUnavailable),
        PluginsState::Available(data) => {
            if let Some(plugin) = data
                .installed
                .iter()
                .find(|plugin| plugin.dir_path == plugin_dir)
            {
                return match plugin.plugin_type {
                    PluginType::Parser => Ok(()),
                    PluginType::ByteSource => Err(RecentValidationError::PluginNotParser(
                        plugin_dir.to_path_buf(),
                    )),
                };
            }

            if data
                .invalid
                .iter()
                .any(|plugin| plugin.dir_path == plugin_dir)
            {
                return Err(RecentValidationError::PluginInvalid(
                    plugin_dir.to_path_buf(),
                ));
            }

            Err(RecentValidationError::PluginMissing(
                plugin_dir.to_path_buf(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{ObserveOptions, ParserType, PluginType, TCPTransportConfig, Transport};
    use tempfile::{NamedTempFile, tempdir};

    use crate::{
        common::time::unix_timestamp_now,
        host::ui::{
            state::plugin::{PluginsData, PluginsState},
            storage::recent::session::{RecentSessionRegistration, RecentSessionSource},
        },
    };

    use super::{
        RecentSessionReopenMode, RecentSessionSnapshot, RecentValidationError,
        validate_reopen_request, validate_saved_parser, validate_sources,
    };

    fn snapshot_from_observe_options(options: ObserveOptions) -> RecentSessionSnapshot {
        RecentSessionRegistration::new(
            unix_timestamp_now(),
            RecentSessionSource::from_observe_origin(options.origin),
            options.parser,
        )
        .into_snapshot(Default::default())
    }

    fn stream_snapshot(bind_addr: &str) -> RecentSessionSnapshot {
        snapshot_from_observe_options(ObserveOptions {
            origin: stypes::ObserveOrigin::Stream(
                String::new(),
                Transport::TCP(TCPTransportConfig {
                    bind_addr: bind_addr.to_owned(),
                }),
            ),
            parser: ParserType::Text(()),
        })
    }

    fn plugin_snapshot(plugin_path: &str) -> RecentSessionSnapshot {
        snapshot_from_observe_options(ObserveOptions::file(
            PathBuf::from("input.log"),
            stypes::FileFormat::Text,
            ParserType::Plugin(stypes::PluginParserSettings {
                plugin_path: PathBuf::from(plugin_path),
                general_settings: stypes::PluginParserGeneralSettings::default(),
                plugin_configs: Vec::new(),
            }),
        ))
    }

    fn parser_plugin(dir_path: &str, wasm_path: &str) -> stypes::PluginEntity {
        stypes::PluginEntity {
            dir_path: PathBuf::from(dir_path),
            plugin_type: PluginType::Parser,
            info: stypes::PluginInfo {
                wasm_file_path: PathBuf::from(wasm_path),
                api_version: stypes::SemanticVersion::V0_1_0,
                plugin_version: stypes::SemanticVersion::V0_1_0,
                config_schemas: Vec::new(),
                render_options: stypes::RenderOptions::Parser(Box::new(
                    stypes::ParserRenderOptions {
                        columns_options: None,
                    },
                )),
            },
            metadata: stypes::PluginMetadata {
                title: "Parser".to_owned(),
                description: None,
            },
            readme_path: None,
        }
    }

    #[test]
    fn validate_accepts_existing_file() {
        let file = NamedTempFile::new().expect("temp source file should be created");
        let snapshot = snapshot_from_observe_options(ObserveOptions::file(
            file.path().to_path_buf(),
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ));

        assert!(validate_sources(&snapshot).is_ok());
    }

    #[test]
    fn validate_rejects_missing_file() {
        let dir = tempdir().expect("temp dir should be created");
        let path = dir.path().join("missing.log");
        let snapshot = snapshot_from_observe_options(ObserveOptions::file(
            path,
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ));

        assert!(validate_sources(&snapshot).is_err());
    }

    #[test]
    fn validate_accepts_stream() {
        let snapshot = stream_snapshot("127.0.0.1:5556");

        assert!(validate_sources(&snapshot).is_ok());
    }

    #[test]
    fn validate_rejects_empty_sources() {
        let snapshot =
            RecentSessionSnapshot::new(1, Vec::new(), ParserType::Text(()), Default::default());

        assert!(validate_sources(&snapshot).is_err());
    }

    #[test]
    fn saved_parser_validation_accepts_installed_plugin() {
        let snapshot = plugin_snapshot("/plugins/parser/parser.wasm");
        let plugins = PluginsState::Available(PluginsData {
            installed: vec![parser_plugin(
                "/plugins/parser",
                "/plugins/parser/parser.wasm",
            )],
            invalid: Vec::new(),
            run_data: Default::default(),
        });

        assert!(validate_saved_parser(&snapshot, &plugins).is_ok());
    }

    #[test]
    fn saved_parser_validation_rejects_missing_plugin() {
        let snapshot = plugin_snapshot("/plugins/missing/parser.wasm");
        let plugins = PluginsState::Available(PluginsData::default());

        assert_eq!(
            validate_saved_parser(&snapshot, &plugins),
            Err(RecentValidationError::PluginMissing(PathBuf::from(
                "/plugins/missing"
            )))
        );
    }

    #[test]
    fn saved_parser_validation_rejects_unavailable_plugins() {
        let snapshot = plugin_snapshot("/plugins/parser/parser.wasm");

        assert_eq!(
            validate_saved_parser(&snapshot, &PluginsState::Unavailable),
            Err(RecentValidationError::PluginManagerUnavailable)
        );
    }

    #[test]
    fn clean_open_skips_plugin_validation() {
        let file = NamedTempFile::new().expect("temp source file should be created");
        let session = RecentSessionSnapshot::new(
            1,
            vec![RecentSessionSource::File {
                format: stypes::FileFormat::Text,
                path: file.path().to_path_buf(),
            }],
            ParserType::Plugin(stypes::PluginParserSettings {
                plugin_path: PathBuf::from("/plugins/missing/parser.wasm"),
                general_settings: stypes::PluginParserGeneralSettings::default(),
                plugin_configs: Vec::new(),
            }),
            Default::default(),
        );

        assert!(
            validate_reopen_request(
                &session,
                RecentSessionReopenMode::OpenClean,
                &PluginsState::Unavailable,
            )
            .is_ok()
        );
        assert!(
            validate_reopen_request(
                &session,
                RecentSessionReopenMode::RestoreSession,
                &PluginsState::Unavailable,
            )
            .is_err()
        );
    }
}
