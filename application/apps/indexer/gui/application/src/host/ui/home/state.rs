use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fmt, fs, io::ErrorKind, mem, path::PathBuf};
use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};

use crate::host::common::file_utls;

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct HomeUiState {
    pub recent_sessions: Vec<RecentSession>,
    pub favorite_folders: Vec<FavoriteFolder>,

    #[serde(skip)]
    pub favorite_search: String,
    #[serde(skip)]
    pub favorite_collapse: bool,
}

impl HomeUiState {
    pub fn load(path: &std::path::Path) -> Self {
        let data = match fs::read_to_string(path) {
            Ok(data) => data,
            Err(err) if err.kind() == ErrorKind::NotFound => {
                return Self::default();
            }
            Err(err) => {
                log::error!(
                    "Failed to read home UI state from {}: {err}",
                    path.display()
                );
                return Self::default();
            }
        };

        let mut settings = match serde_json::from_str::<HomeUiState>(&data) {
            Ok(settings) => settings,
            Err(err) => {
                log::error!(
                    "Failed to parse home UI state from {}: {err}",
                    path.display()
                );
                return Self::default();
            }
        };

        settings.update_configurations();
        settings.update_favorites();
        settings
    }

    pub fn save(&self, path: &std::path::Path) -> Result<()> {
        let data =
            serde_json::to_string_pretty(self).context("Failed to serialize home UI state")?;
        fs::write(path, data)
            .with_context(|| format!("Failed to write home UI state to {}", path.display()))
    }

    pub fn update_configurations(&mut self) {
        self.recent_sessions.retain_mut(|session| {
            let mut valid_configurations = Vec::with_capacity(session.configurations.len());
            let mut invalid_details = Vec::new();

            for config in mem::take(&mut session.configurations) {
                match config.validate() {
                    Ok(()) => valid_configurations.push(config),
                    Err(err) => invalid_details.push(format!("{config}: {err}")),
                }
            }

            session.configurations = valid_configurations;

            if !invalid_details.is_empty() {
                let invalid_count = invalid_details.len();
                log::warn!(
                    "Removed {invalid_count} invalid recent configuration(s) from session \"{}\": {}",
                    session.title,
                    invalid_details.join("; ")
                );
            }

            !session.configurations.is_empty()
        });
    }

    pub fn update_favorites(&mut self) {
        for folder in &mut self.favorite_folders {
            folder.scan();
        }

        self.favorite_folders.sort_by(|a, b| a.path.cmp(&b.path));
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RecentSession {
    pub title: String,
    pub last_opened: u64,
    pub configurations: Vec<SessionConfig>,
}

impl RecentSession {
    /// Get a template for a new configuration, if supported.
    pub fn new_configuration(&self) -> Option<&SessionConfig> {
        self.configurations
            .first()
            .and_then(|cfg| match &cfg.options.origin {
                ObserveOrigin::File(_, format, _) if *format == FileFormat::Text => None,
                ObserveOrigin::File(..) | ObserveOrigin::Concat(..) => Some(cfg),
                ObserveOrigin::Stream(..) => None,
            })
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionConfig {
    /// The unique Hash of the config.
    pub id: String,
    /// The ObserveOptions of the config.
    pub options: ObserveOptions,
}

impl SessionConfig {
    pub fn from_observe_options(options: &ObserveOptions) -> Option<Self> {
        let opts = ObserveOptions {
            origin: match &options.origin {
                ObserveOrigin::File(_, format, path) => {
                    ObserveOrigin::File(String::new(), *format, path.clone())
                }
                ObserveOrigin::Concat(files) => ObserveOrigin::Concat(
                    files
                        .iter()
                        .map(|(_, format, path)| (String::new(), *format, path.clone()))
                        .collect(),
                ),
                ObserveOrigin::Stream(_, transport) => {
                    ObserveOrigin::Stream(String::new(), transport.clone())
                }
            },
            parser: options.parser.clone(),
        };

        if let Ok(json) = serde_json::to_string_pretty(&opts) {
            Some(SessionConfig {
                id: blake3::hash(json.as_bytes()).to_hex().to_string(),
                options: opts,
            })
        } else {
            None
        }
    }

    pub fn validate(&self) -> std::io::Result<()> {
        match &self.options.origin {
            ObserveOrigin::File(_, _, path) => {
                if path.exists() {
                    Ok(())
                } else {
                    Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        format!("File not found: {}", path.display()),
                    ))
                }
            }

            ObserveOrigin::Concat(files) => {
                for (_, _, path) in files {
                    if !path.exists() {
                        return Err(std::io::Error::new(
                            std::io::ErrorKind::NotFound,
                            format!("File not found: {}", path.display()),
                        ));
                    }
                }
                Ok(())
            }

            ObserveOrigin::Stream(_, _) => Ok(()),
        }
    }
}

impl fmt::Display for SessionConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.options.origin {
            ObserveOrigin::File(_, _, _) => {
                // name is already shown by title
            }
            ObserveOrigin::Concat(files) => {
                write!(f, "[ ")?;
                for (_, _, path) in files {
                    write!(f, "{} ", file_name(path))?;
                }
                write!(f, "] ")?;
            }
            ObserveOrigin::Stream(_, transport) => {
                match transport {
                    Transport::Process(_) => {
                        write!(f, "CMD ")?;
                    }
                    Transport::Serial(_) => {
                        write!(f, "Serial ")?;
                    }
                    Transport::UDP(_) => {
                        write!(f, "UDP ")?;
                    }
                    Transport::TCP(_) => {
                        write!(f, "TCP ")?;
                    }
                };
            }
        };

        match &self.options.parser {
            ParserType::Dlt(settings) => {
                write!(f, "DLT")?;
                if let Some(filter) = &settings.filter_config {
                    match filter.min_log_level {
                        Some(1) => write!(f, " FATAL")?,
                        Some(2) => write!(f, " ERROR")?,
                        Some(3) => write!(f, " WARN")?,
                        Some(4) => write!(f, " INFO")?,
                        Some(5) => write!(f, " DEBUG")?,
                        Some(6) => write!(f, " VERBOSE")?,
                        _ => {}
                    };
                    if let Some(ecus) = &filter.ecu_ids
                        && !ecus.is_empty()
                    {
                        write!(f, ", ECUs: {}", ecus.len())?;
                    }
                    if filter.app_id_count > 0 {
                        write!(f, ", APPs: {}", filter.app_id_count)?;
                    }
                    if filter.context_id_count > 0 {
                        write!(f, ", CTXs: {}", filter.context_id_count)?;
                    }
                }
                if let Some(paths) = &settings.fibex_file_paths
                    && !paths.is_empty()
                {
                    write!(f, ", Fibex:")?;
                    for path in paths {
                        write!(f, " {}", file_name(&PathBuf::from(path)))?;
                    }
                }
            }
            ParserType::SomeIp(settings) => {
                write!(f, "SOME/IP")?;
                if let Some(paths) = &settings.fibex_file_paths
                    && !paths.is_empty()
                {
                    write!(f, ", Fibex:")?;
                    for path in paths {
                        write!(f, " {}", file_name(&PathBuf::from(path)))?;
                    }
                }
            }
            ParserType::Text(()) => {
                write!(f, "Text")?;
            }
            ParserType::Plugin(settings) => {
                write!(
                    f,
                    "Plugin ({})",
                    file_name(&PathBuf::from(&settings.plugin_path))
                )?;
            }
        };

        Ok(())
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FavoriteFolder {
    pub path: PathBuf,

    #[serde(skip)]
    pub files: Vec<FileUiInfo>,
}

#[derive(Debug, Clone)]
pub struct FileUiInfo {
    pub name: String,
    pub size_txt: String,
}

impl FileUiInfo {
    fn new(name: String, size_txt: String) -> Self {
        Self { name, size_txt }
    }
}

impl FavoriteFolder {
    pub fn new(path: PathBuf) -> Self {
        FavoriteFolder {
            path,
            files: vec![],
        }
    }

    pub fn scan(&mut self) {
        self.files.clear();

        let entries = match std::fs::read_dir(&self.path) {
            Ok(entries) => entries,
            Err(err) => {
                log::error!(
                    "Failed to scan favorite folder {}: {err}",
                    self.path.display()
                );
                return;
            }
        };

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(err) => {
                    log::warn!(
                        "Failed to read an entry in favorite folder {}: {err}",
                        self.path.display()
                    );
                    continue;
                }
            };

            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(err) => {
                    log::warn!(
                        "Failed to read metadata for {} while scanning favorite folder {}: {err}",
                        entry.path().display(),
                        self.path.display()
                    );
                    continue;
                }
            };

            if metadata.file_type().is_symlink() {
                continue;
            }

            if metadata.is_file() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') {
                    continue;
                }

                let size = metadata.len();
                let size_info = file_utls::format_file_size(size);

                self.files.push(FileUiInfo::new(file_name, size_info));
            }
        }
    }
}

fn file_name(path: &PathBuf) -> String {
    path.file_name()
        .and_then(|f| f.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{:?}", path))
}
