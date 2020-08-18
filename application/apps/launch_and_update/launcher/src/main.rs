#![windows_subsystem = "windows"]

extern crate chrono;
extern crate dirs;
extern crate flate2;
#[macro_use]
extern crate log;
extern crate log4rs;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use anyhow::{anyhow, Result};
use base::{
    chipmunk_home_dir, chipmunk_log_config, initialize_from_fresh_yml, setup_fallback_logging,
};
use crossbeam_channel::{bounded, select, tick, Receiver};
use std::{
    env,
    fs,
    io::prelude::*,
    path::{Path, PathBuf},
    process::{Child, Command},
    time::{Duration, SystemTime},
};

enum ElectronExitCode {
    NormalExit = 0,
    UpdateRequired = 131,
    RestartRequired = 132,
}

fn init_logging() -> Result<()> {
    let log_config_path = chipmunk_log_config();
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let logging_correctly_initialized = if log_config_path.exists() {
        // make sure the env variables are correctly replaced
        let mut content = String::new();
        {
            let mut log_config_file = fs::File::open(&log_config_path)?;
            log_config_file.read_to_string(&mut content)?;
        }
        let log_config_content = content.replace("$HOME_DIR", &home_dir.to_string_lossy());

        match fs::write(&log_config_path, &log_config_content) {
            Ok(_) => (),
            Err(e) => eprintln!("error while trying to write log config file: {}", e),
        }

        // log4rs.yaml exists, try to parse it
        match log4rs::init_file(&log_config_path, Default::default()) {
            Ok(()) => true,
            Err(e) => {
                eprintln!("problems with existing log config ({}), write fresh", e);
                // log4rs.yaml exists, could not parse it
                initialize_from_fresh_yml().is_ok()
            }
        }
    } else {
        // log4rs.yaml did not exists
        initialize_from_fresh_yml().is_ok()
    };
    if !logging_correctly_initialized {
        setup_fallback_logging()?;
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn spawn(exe: &Path, args: &[&str]) -> Result<Child> {
    Command::new(exe)
        .args(args)
        .spawn()
        .map_err(|e| anyhow!("{}", e))
}

#[cfg(target_os = "windows")]
fn spawn(exe: &Path, args: &[&str]) -> Result<Child> {
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    Command::new(exe)
        .args(args)
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .spawn()
        .map_err(|e| anyhow!("{}", e))
}

/// on macos it will result in /xyz/chipmunk.app
fn electron_app_path() -> Result<PathBuf> {
    let launcher = std::env::current_exe()?;
    if cfg!(target_os = "macos") {
        // /xyz/chipmunk.app/Contents/MacOS/app
        let cropped = launcher
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
            .ok_or_else(|| anyhow!("could not get parent of {:?}", launcher))?;
        Ok(PathBuf::from(cropped))
    } else {
        let parent_path = launcher
            .parent()
            .ok_or_else(|| anyhow!("no parent found"))?;
        Ok(parent_path.join(app_name()))
    }
}

fn app_name() -> String {
    if cfg!(target_os = "windows") {
        "app.exe"
    } else {
        "app"
    }
    .to_string()
}

/// on macos it looks like /xyz/chipmunk.app/Contents/MacOS/app
fn find_electron_app() -> Result<PathBuf> {
    let root = std::env::current_exe()?;
    let root_path = Path::new(&root)
        .parent()
        .ok_or_else(|| anyhow!("no parent found"))?;

    Ok(root_path.join(app_name()))
}

fn get_updater_path() -> Result<PathBuf> {
    let updater_path = chipmunk_home_dir().join("apps");
    Ok(if cfg!(target_os = "windows") {
        updater_path.join("updater.exe")
    } else {
        updater_path.join("updater")
    })
}

fn update_package_path() -> Result<Option<PathBuf>> {
    let downloads_path = chipmunk_home_dir().join("downloads");
    let mut maxunixts = 0;
    let mut target = None;
    for entry in downloads_path
        .read_dir()
        .expect("Fail read downloads folder")
    {
        if let Ok(entry) = entry {
            let path_buf = entry.path();
            if let Some(ext) = path_buf.extension() {
                if path_buf.is_file() && ext == "tgz" {
                    let metadata = std::fs::metadata(&path_buf)?;
                    if let Ok(time) = metadata.modified() {
                        let unixts = time
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .map_err(|error| {
                                anyhow::Error::new(error)
                                    .context("could not get time diff for unix timestamp")
                            })?
                            .as_secs();
                        if unixts > maxunixts {
                            maxunixts = unixts;
                            target = Some(path_buf);
                        }
                    } else {
                        warn!("Not supported on this platform");
                    }
                }
            }
        }
    }
    Ok(target)
}

fn update() -> Result<bool> {
    
    let updater_path = get_updater_path()?;

    if !updater_path.exists() {
        error!("File of updater {:?} doesn't exist", updater_path);
        return Ok(false);
    }

    trace!("Starting updater: {:?}", updater_path);
    match update_package_path()? {
        None => {
            error!("Failed to start update because update package seems to be missing",);
            std::process::exit(0);
        }
        Some(update_package) => {
            let app = electron_app_path()?;
            trace!(
                "Detected\n\t-\tapp: {:?};\n\t-\ttgz: {:?}",
                app,
                update_package
            );
            let child = spawn(&updater_path, &[
                &app.to_str().expect("Expecting app has to be valid path"),
                &update_package.to_str().expect("Expected update_package has to be valid path")]);
            match child {
                Ok(_child) => {
                    debug!("Updater is started ({:?})", updater_path);
                    trace!("Close launcher");
                    std::process::exit(0);
                }
                Err(e) => {
                    error!("Fail to start updater due error: {}", e);
                }
            };
        }
    }
    Ok(true)
}

fn ctrl_channel() -> Result<Receiver<()>, ctrlc::Error> {
    let (sender, receiver) = bounded(100);
    ctrlc::set_handler(move || {
        let _ = sender.send(());
    })?;

    Ok(receiver)
}
fn main() -> Result<()> {
    match init_logging() {
        Ok(()) => trace!("Launcher started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {}", e),
    }

    let ctrl_c_events = ctrl_channel()?;

    let electron_app = match find_electron_app() {
        Ok(app) => app,
        Err(e) => {
            error!("path to executable not found: {}", e);
            std::process::exit(1);
        }
    };

    trace!("Target application: {:?}", electron_app);

    let electron_app_path = Path::new(&electron_app);

    if !electron_app_path.exists() {
        error!("electron app not found! {:?}", electron_app_path);
        std::process::exit(1);
    }

    let mut start_required = true;
    while start_required {
        start_required = false;
        let env_args = env::args().collect::<Vec<String>>();
        debug!("Starting application");
        let mut args: Vec<&str> = vec![];
        args.append(&mut env_args.iter().map(|a| a.as_ref()).collect::<Vec<&str>>());
        debug!("It means, it's updated");
        let child: Result<Child> = spawn(&electron_app, &[]);
        match child {
            Ok(mut child) => {
                let pid = child.id();

                info!("Electron application is started (pid: {})", pid);
                let ticks = tick(Duration::from_secs(1));

                loop {
                    select! {
                        recv(ticks) -> _ => {
                            match child.try_wait() {
                                Ok(Some(result)) => {
                                    let exit_code = result.code();
                                    start_required = handle_exit_code(exit_code);
                                    break;
                                }
                                Ok(None) => (),
                                Err(e) => {
                                    error!("Error during running app: {}", e);
                                }
                            }
                        }
                        recv(ctrl_c_events) -> _ => {
                            warn!("Detected Ctrl-C ...Goodbye!");
                            child.kill()?;
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to start app ({})", e);
            }
        };
        debug!("start is required: {}", start_required);
    }
    debug!("exiting...start is required: {}", start_required);
    Ok(())
}

fn handle_exit_code(exit_code: Option<i32>) -> bool {
    trace!("App is finished with code: {:?}", exit_code);
    match exit_code {
        Some(code) if code == ElectronExitCode::NormalExit as i32 => {
            // node app was closed
            info!("No update required, exiting");
        }
        Some(code) if code == ElectronExitCode::UpdateRequired as i32 => {
            // node app was closed and update requested
            info!("Update is required");
            match update() {
                Ok(res) => debug!("updated finished {} OK", if res { "" } else { "not" }),
                Err(e) => error!("update failed: {}", e),
            }
        }
        Some(code) if code == ElectronExitCode::RestartRequired as i32 => {
            // node app was closed and but needs a restart
            info!("Restart is required");
            return true;
        }
        other_exit => {
            warn!("received unknown exit code {:?}! exiting...", other_exit);
        }
    }
    false
}
