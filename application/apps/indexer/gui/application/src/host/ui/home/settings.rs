use serde::{Deserialize, Serialize};
use std::{fmt, fs, path::PathBuf};
use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct HomeSettings {
    pub recent_sessions: Vec<RecentSession>,
    pub favorite_folders: Vec<FavoriteFolder>,

    #[serde(skip)]
    pub favorite_search: String,
    #[serde(skip)]
    pub favorite_collapse: bool,
}

impl HomeSettings {
    pub fn load(path: &std::path::Path) -> Option<Self> {
        if let Ok(data) = fs::read_to_string(path) {
            let mut settings: HomeSettings = serde_json::from_str(&data).unwrap_or_default();
            settings.update_configurations();
            settings.update_favorites();
            Some(settings)
        } else {
            None
        }
    }

    pub fn save(&self, path: &std::path::Path) {
        if let Ok(data) = serde_json::to_string_pretty(self) {
            let _ = fs::write(path, data);
        }
    }

    pub fn update_configurations(&mut self) {
        for session in &mut self.recent_sessions {
            session.configurations.retain(|cfg| cfg.validate().is_ok());
        }

        self.recent_sessions
            .retain(|session| !session.configurations.is_empty());
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
        if let Some(cfg) = self.configurations.first() {
            return match &cfg.options.origin {
                ObserveOrigin::File(_, format, _) => {
                    if *format == FileFormat::Text {
                        None
                    } else {
                        Some(cfg)
                    }
                }
                ObserveOrigin::Concat(_) => Some(cfg),
                ObserveOrigin::Stream(_, _) => None,
            };
        }

        None
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
    pub files: Vec<(String, String)>,
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

        if let Ok(entries) = std::fs::read_dir(&self.path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.file_type().is_symlink() {
                        continue;
                    }

                    if metadata.is_file() {
                        let file_name = entry.file_name().to_string_lossy().to_string();
                        if file_name.starts_with('.') {
                            continue;
                        }

                        let size = metadata.len();
                        let size_info = file_size(size);

                        self.files.push((file_name, size_info));
                    }
                }
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

fn file_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    const TB: f64 = GB * 1024.0;

    let bytes = bytes as f64;

    if bytes >= TB {
        format!("{:.2} TB", bytes / TB)
    } else if bytes >= GB {
        format!("{:.2} GB", bytes / GB)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes / MB)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes / KB)
    } else {
        format!("{} B", bytes as u64)
    }
}
