pub mod util;

use crate::util::remove_entity;
use anyhow::{Result, *};
use log::LevelFilter;
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
};
use std::path::PathBuf;

pub fn chipmunk_home_dir() -> PathBuf {
    dirs::home_dir()
        .expect("we need to have access to home-dir")
        .join(".chipmunk")
}

pub fn chipmunk_log_config() -> PathBuf {
    chipmunk_home_dir().join("log4rs.yaml")
}

pub fn initialize_from_fresh_yml() -> Result<()> {
    let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("Could not access home-directory"))?;
    let log_config_path = chipmunk_log_config();
    let indexer_log_path = chipmunk_home_dir().join("chipmunk.indexer.log");
    let launcher_log_path = chipmunk_home_dir().join("chipmunk.launcher.log");
    let log_config_content = std::include_str!("../log4rs.yaml")
        .replace("$INDEXER_LOG_PATH", &indexer_log_path.to_string_lossy())
        .replace("$LAUNCHER_LOG_PATH", &launcher_log_path.to_string_lossy())
        .replace("$HOME_DIR", &home_dir.to_string_lossy());
    remove_entity(&log_config_path)?;
    std::fs::write(&log_config_path, log_config_content)?;
    log4rs::init_file(&log_config_path, Default::default())?;
    Ok(())
}

pub fn setup_fallback_logging() -> Result<()> {
    let log_path = chipmunk_home_dir().join("chipmunk.launcher.log");
    let appender_name = "startup-appender";
    let logfile = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d} - {l}:: {m}\n")))
        .build(log_path)?;

    let config = Config::builder()
        .appender(Appender::builder().build(appender_name, Box::new(logfile)))
        .build(
            Root::builder()
                .appender(appender_name)
                .build(LevelFilter::Trace),
        )
        .expect("log4rs config could not be created");

    log4rs::init_config(config).expect("logging could not be initialized");
    Ok(())
}
