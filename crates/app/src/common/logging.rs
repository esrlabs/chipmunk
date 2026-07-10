//! Application logging setup and default log4rs configuration.

use std::{
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use log::LevelFilter;
use log4rs::{
    append::{
        console::{ConsoleAppender, Target},
        file::FileAppender,
    },
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
};

const LOG_CONFIG_VERSION: &str = "3.0";
const LOG_CONFIG_FILE: &str = "log4rs.yaml";
const LOG_FILE: &str = "chipmunk.log";
const LOG_FILE_ARCHIVE_PATTERN: &str = "chipmunk.log.{}";
const APP_LOG_APPENDER: &str = "app-log";
const FALLBACK_PATTERN: &str = "{d} [{M}] {l}:: {m}{n}";

/// Initializes the application logger from the user config or regenerates defaults.
pub fn setup() {
    if try_setup("file logging", setup_file_logging) {
        return;
    }

    if try_setup("fallback file logging", setup_fallback_logging) {
        return;
    }

    if !try_setup("stderr logging", setup_stderr_logging) {
        eprintln!("Logging is disabled.");
    }
}

fn try_setup(label: &str, setup: impl FnOnce() -> Result<()>) -> bool {
    match setup() {
        Ok(()) => true,
        Err(err) => {
            eprintln!("Failed to initialize {label}: {err:#}.");
            false
        }
    }
}

fn setup_file_logging() -> Result<()> {
    let config_path = chipmunk_log_config()?;
    let is_config_valid = validate_log_config_file(&config_path);

    if is_config_valid {
        log4rs::init_file(&config_path, Default::default())
            .map(|_| ())
            .or_else(|err| {
                eprintln!("Failed to initialize existing log config: {err}. Regenerating it.");
                reset_log_config()
            })
    } else {
        reset_log_config()
    }
}

fn reset_log_config() -> Result<()> {
    let config_path = chipmunk_log_config()?;
    let home_dir = chipmunk_home_dir()?;
    let log_path = home_dir.join(LOG_FILE);
    let archive_pattern = home_dir.join(LOG_FILE_ARCHIVE_PATTERN);
    let config_content = default_log_config(&log_path, &archive_pattern);

    fs::write(&config_path, config_content).context("can't write logging config file")?;

    log4rs::init_file(&config_path, Default::default())
        .map(|_| ())
        .context("can't initialize logger from generated config")
}

fn setup_fallback_logging() -> Result<()> {
    let log_path = chipmunk_home_dir()?.join(LOG_FILE);
    let fallback_encoder = PatternEncoder::new(FALLBACK_PATTERN);
    let logfile = FileAppender::builder()
        .encoder(Box::new(fallback_encoder))
        .build(log_path)?;

    let config = Config::builder()
        .appender(Appender::builder().build(APP_LOG_APPENDER, Box::new(logfile)))
        .build(
            Root::builder()
                .appender(APP_LOG_APPENDER)
                .build(LevelFilter::Warn),
        )
        .context("can't create fallback logger config")?;

    log4rs::init_config(config)
        .map(|_| ())
        .context("can't initialize fallback logger")
}

fn setup_stderr_logging() -> Result<()> {
    let fallback_encoder = PatternEncoder::new(FALLBACK_PATTERN);
    let stderr = ConsoleAppender::builder()
        .target(Target::Stderr)
        .encoder(Box::new(fallback_encoder))
        .build();

    let config = Config::builder()
        .appender(Appender::builder().build(APP_LOG_APPENDER, Box::new(stderr)))
        .build(
            Root::builder()
                .appender(APP_LOG_APPENDER)
                .build(LevelFilter::Warn),
        )
        .context("can't create stderr logger config")?;

    log4rs::init_config(config)
        .map(|_| ())
        .context("can't initialize stderr logger")
}

fn chipmunk_log_config() -> Result<PathBuf> {
    chipmunk_home_dir()
        .map(|home| home.join(LOG_CONFIG_FILE))
        .context("can't get logging config path")
}

fn chipmunk_home_dir() -> Result<PathBuf> {
    let home_dir = session_core::paths::get_home_dir()
        .map_err(|err| anyhow::anyhow!("can't determine Chipmunk home directory: {err}"))?;

    fs::create_dir_all(&home_dir).context("can't create Chipmunk home directory")?;

    Ok(home_dir)
}

/// Returns true when the existing log config matches the current supported version.
fn validate_log_config_file(file_path: &Path) -> bool {
    if !file_path.exists() {
        return false;
    }

    let file = match File::open(file_path) {
        Ok(file) => file,
        Err(err) => {
            eprintln!("Failed to open logging config file: {err}");
            return false;
        }
    };

    let mut lines = BufReader::new(file).lines();
    let first_line = match lines.next() {
        Some(Ok(line)) => line,
        Some(Err(err)) => {
            eprintln!("Failed to read logging config file: {err}");
            return false;
        }
        None => return false,
    };

    first_line.trim() == format!("# chipmunk_logconf_version: {LOG_CONFIG_VERSION}")
}

fn default_log_config(log_path: &Path, archive_pattern: &Path) -> String {
    format!(
        r#"# chipmunk_logconf_version: {LOG_CONFIG_VERSION}
refresh_rate: 30 seconds

# Console output is disabled by default because GUI launches usually have no terminal.
# Enable stdout or stderr below to mirror logs when launching Chipmunk from a terminal.
appenders:
    app-log:
        kind: rolling_file
        path: {log_path}
        append: true
        encoder:
            kind: pattern
            pattern: "{{d}} [{{M}}] {{l}}:: {{m}}{{n}}"
        policy:
            kind: compound
            trigger:
                kind: size
                limit: 10 mb
            roller:
                kind: fixed_window
                pattern: {archive_pattern}
                base: 1
                count: 5
    # stdout:
    #     kind: console
    #     target: stdout
    #     encoder:
    #         kind: pattern
    #         pattern: "[{{l}}][{{t}}: {{M}}][{{d(%H:%M:%S)}}] {{m}}{{n}}"
    # stderr:
    #     kind: console
    #     target: stderr
    #     encoder:
    #         kind: pattern
    #         pattern: "[{{l}}][{{t}}: {{M}}][{{d(%H:%M:%S)}}] {{m}}{{n}}"

root:
    # level: off
    # level: error
    level: warn
    # level: info
    # level: debug
    # level: trace
    appenders:
        - app-log
        # - stdout
        # - stderr
"#,
        log_path = yaml_path(log_path),
        archive_pattern = yaml_path(archive_pattern),
    )
}

fn yaml_path(path: &Path) -> String {
    // JSON strings are valid YAML scalars and safely escape paths like `C:\\Users\\A B\\log.txt`.
    serde_json::to_string(&path.to_string_lossy()).expect("serializing path should not fail")
}
