#[macro_use]
extern crate log;
extern crate log4rs;
mod env;
mod updater;

use env::args::Arguments;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum GeneralError {
    #[error("Logger error ({0})")]
    Logger(String),
    #[error("Arguments error ({0})")]
    Arguments(env::args::ArgumentsError),
    #[error("Update error ({0})")]
    UpdateError(updater::UpdateError),
    #[error("Sys error ({0})")]
    SysError(String),
}

fn main() -> Result<(), GeneralError> {
    let version = env::sys::version();
    println!("[updater ver: {version}] Updating chipmunk...");
    println!(
        "Please do not close this terminal, it will be closed as soon as chipmunk will be updated."
    );
    env::logs::initialize_from_fresh_yml().map_err(|e| {
        eprintln!("Couldn't initialize logging: {e}");
        GeneralError::Logger(e.to_string())
    })?;
    log::debug!("Updater ver. {version} has been started");
    let args = Arguments::new().map_err(|e| {
        log::error!("Fail to parse arguments: {e:?}");
        GeneralError::Arguments(e)
    })?;
    let app_path = args.app.clone();
    updater::update(args).map_err(|e| {
        log::error!("Fail to update: {e:?}");
        GeneralError::UpdateError(e)
    })?;
    log::debug!("Chipmunk has been updated");
    env::sys::start(app_path).map_err(|e| {
        log::error!("Fail to restart application: {e}");
        GeneralError::SysError(e.to_string())
    })?;
    log::debug!("Restarting is triggered");
    log::debug!("Good buy!");
    Ok(())
}
