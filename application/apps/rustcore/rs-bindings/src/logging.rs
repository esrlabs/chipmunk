//! Module to manage setting up and configuring logging on Chipmunk Core.

use anyhow::{Context, Result};
use log::LevelFilter;
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
};
use node_bindgen::init::node_bindgen_init_once;
use std::{
    fs::{self, File},
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
};

/// The current version of logging configurations file.
pub const LOG_CONFIG_VERSION: &str = "2.0";

/// Logging targets.
pub mod targets {
    /// Target for `session` module in chipmunk core.
    pub const SESSION: &str = "session";
}

#[node_bindgen_init_once]
fn init_module() {
    if let Err(e) = init_logging() {
        eprintln!("Problems setting up logging: {e}");
    }
}

/// Initialize logging reading logging configurations from `log4rs.yaml` file or generating
/// it with the default values if needed.
pub fn init_logging() -> Result<()> {
    let log_config_path = chipmunk_log_config()?;
    let init_log_result = if validate_log_config_file(&log_config_path) {
        // log4rs.yaml exists with matching version, try to parse it
        match log4rs::init_file(&log_config_path, Default::default()) {
            Ok(()) => Ok(()),
            Err(e) => {
                eprintln!("problems with existing log config ({e}), write fresh");
                // log4rs.yaml exists, could not parse it
                initialize_from_fresh_yml()
            }
        }
    } else {
        // log4rs.yaml did not exists
        initialize_from_fresh_yml()
    };

    if let Err(err) = init_log_result {
        eprintln!("Error while initializing logger from new config file: {err:?}");
        setup_fallback_logging()?;
    }

    Ok(())
}

/// Return the path of log configurations file in chipmunk home directory.
pub fn chipmunk_log_config() -> Result<PathBuf> {
    chipmunk_home_dir()
        .map(|home| home.join("log4rs.yaml"))
        .context("Can't get the path of logging configurations file.")
}

/// Return the path of chipmunk home directory, creating it if doesn't exist.
///
/// It'll return an error if the home directory can't be determined in host environment
/// or if creating chipmunk directory fails.
pub fn chipmunk_home_dir() -> Result<PathBuf> {
    let home_dir = dirs::home_dir()
        .context("Determining the path of home directory failed")?
        .join(".chipmunk");
    if !home_dir.exists() {
        fs::create_dir(&home_dir).context("Creating Chipmunk home directory failed")?;
    }

    Ok(home_dir)
}

/// Checks if log configurations file exists and has matching version to the current one.
/// This function assumes that the first line of the config file has the pattern
/// `# chipmunk_logconf_version: $LOG_CONFIG_VERSION` and it will return false if this pattern
/// doesn't match or on IO errors.
fn validate_log_config_file(file_path: &Path) -> bool {
    if !file_path.exists() {
        return false;
    }

    let file = match File::open(file_path) {
        Ok(file) => file,
        Err(err) => {
            eprintln!("Error while opening logging config file: {err}");
            return false;
        }
    };

    let reader = BufReader::new(file);
    let first_line = match reader.lines().next() {
        Some(Ok(line)) => line,
        Some(Err(err)) => {
            eprintln!("Error while reading logging config file: {err}");
            return false;
        }
        None => {
            eprintln!("Error: Logging config file is empty");
            return false;
        }
    };

    let version = match first_line.split(": ").nth(1) {
        Some(version) => version.trim(),
        None => {
            eprintln!("Parsing the version of logging config file failed");
            return false;
        }
    };

    if version != LOG_CONFIG_VERSION {
        println!(
            "Logging configuration version mismatched. Expected: {LOG_CONFIG_VERSION}, found {version}"
        );
        return false;
    }

    true
}

/// Creates a new configurations yaml file then initialize the logger with it.
pub fn initialize_from_fresh_yml() -> Result<()> {
    println!("Initialization of logs is started on rs-bindings layer");
    let log_config_path = chipmunk_log_config()?;
    let chipmunk_home_dir = chipmunk_home_dir()?;
    let indexer_log_path = chipmunk_home_dir.join("chipmunk.indexer.log");
    let launcher_log_path = chipmunk_home_dir.join("chipmunk.launcher.log");
    let log_config_content = std::include_str!("../log4rs.yaml")
        .replace("$LOG_CONFIG_VERSION", LOG_CONFIG_VERSION)
        .replace("$INDEXER_LOG_PATH", &indexer_log_path.to_string_lossy())
        .replace("$LAUNCHER_LOG_PATH", &launcher_log_path.to_string_lossy());

    if log_config_path.exists() {
        std::fs::remove_file(&log_config_path)
            .context("Error while removing invalid log configurations file")?;
    }

    std::fs::write(&log_config_path, log_config_content)
        .context("Error while writing to log configurations file")?;

    log4rs::init_file(&log_config_path, Default::default())?;
    println!("Initialization of logs is finished:\n{indexer_log_path:?}\n{launcher_log_path:?}");

    Ok(())
}

/// Initialize Logging with the hard coded configurations without using log configurations files.
pub fn setup_fallback_logging() -> Result<()> {
    println!("[setup_fallback_logging]: Initialization of logs is started on rs-bindings layer");
    let log_path = chipmunk_home_dir()?.join("chipmunk.launcher.log");
    let appender_name = "startup-appender";
    let logfile = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d} - {l}:: {m}\n")))
        .build(log_path)?;

    let config = Config::builder()
        .appender(Appender::builder().build(appender_name, Box::new(logfile)))
        .build(
            Root::builder()
                .appender(appender_name)
                .build(LevelFilter::Warn),
        )
        .expect("log4rs config could not be created");

    log4rs::init_config(config).expect("logging could not be initialized");
    println!("[setup_fallback_logging]:Initialization of logs is finished");
    Ok(())
}
