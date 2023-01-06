use crate::env::fs::remove_entity;
use anyhow::{Result, *};
use log4rs;
use std::path::PathBuf;

pub fn chipmunk_home_dir() -> PathBuf {
    dirs::home_dir()
        .expect("we need to have access to home-dir")
        .join(".chipmunk")
}

pub fn chipmunk_log_config() -> PathBuf {
    chipmunk_home_dir().join("log4rs_updater.yaml")
}

pub fn initialize_from_fresh_yml() -> Result<()> {
    let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("Could not access home-directory"))?;
    let log_config_path = chipmunk_log_config();
    let log_path = chipmunk_home_dir().join("chipmunk.updater.log");
    let log_config_content = std::include_str!("../../log4rs.yaml")
        .replace("$LOG_PATH", &log_path.to_string_lossy())
        .replace("$HOME_DIR", &home_dir.to_string_lossy());
    remove_entity(&log_config_path)?;
    std::fs::write(&log_config_path, log_config_content)?;
    log4rs::init_file(&log_config_path, Default::default())?;
    Ok(())
}
