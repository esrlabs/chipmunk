use log::{Level, LevelFilter, Metadata, Record};
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
};
use std::{fs, io, io::prelude::*, time::SystemTime};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LoggingError {
    #[error("Setup logging failed ({0})")]
    Setup(#[from] io::Error),
    #[error("Config wrong ({0})")]
    Config(#[from] log::SetLoggerError),
}

pub struct SimpleLogger;

impl log::Log for SimpleLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Trace
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            println!(
                "[RUST]:{}({:?}) {} - {}",
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis(),
                std::thread::current().id(),
                record.level(),
                record.args()
            );
        }
    }

    fn flush(&self) {}
}

pub fn init_logging() -> Result<(), LoggingError> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_file_path = home_dir.join(".chipmunk").join("chipmunk.indexer.log");
    let log_config_path = home_dir.join(".chipmunk").join("log4rs.yaml");
    if !log_config_path.exists() {
        let log_config_content = std::include_str!("../log4rs.yaml")
            .replace("$LOG_FILE_PATH", &log_file_path.to_string_lossy())
            .replace("$HOME_DIR", &home_dir.to_string_lossy());

        match std::fs::write(&log_config_path, log_config_content) {
            Ok(_) => (),
            Err(e) => eprintln!("error while trying to write log config file: {}", e),
        }
    } else {
        // make sure the env variables are correctly replaced
        let mut content = String::new();
        {
            let mut log_config_file = fs::File::open(&log_config_path)?;
            log_config_file.read_to_string(&mut content)?;
        }
        let log_config_content = content
            .replace("$LOG_FILE_PATH", &log_file_path.to_string_lossy())
            .replace("$HOME_DIR", &home_dir.to_string_lossy());

        match fs::write(&log_config_path, &log_config_content) {
            Ok(_) => (),
            Err(e) => eprintln!("error while trying to write log config file: {}", e),
        }
    }

    match log4rs::init_file(&log_config_path, Default::default()) {
        Ok(_) => (),
        Err(e) => {
            eprintln!("could not initialize logging with init_file: {}", e);
            let log_path = home_dir.join(".chipmunk").join("chipmunk.indexer.log");
            let appender_name = "indexer-root";
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
                .expect("logging config was incorrect");
            log4rs::init_config(config)?;
        }
    }
    Ok(())
}
