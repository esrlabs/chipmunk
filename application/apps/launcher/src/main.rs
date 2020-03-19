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
use log::LevelFilter;
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
};
use std::{
    path::Path,
    path::PathBuf,
    process::{Child, Command},
    time::SystemTime,
};

enum ElectronExitCode {
    NormalExit = 0,
    UpdateRequired = 131,
    RestartRequired = 132,
}

fn init_logging() -> Result<()> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_config_path = home_dir.join(".chipmunk").join("log4rs.yaml");
    let initialized = if log_config_path.exists() {
        match log4rs::init_file(log_config_path, Default::default()) {
            Ok(()) => true,
            _ => false,
        }
    } else {
        false
    };
    if !initialized {
        let log_path = home_dir.join(".chipmunk").join("chipmunk.indexer.log");
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
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe)
        .args(args)
        .spawn()
        .map_err(|e| anyhow!("{}", e))
}

#[cfg(target_os = "windows")]
fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    const DETACHED_PROCESS: u32 = 0x00000008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
    Command::new(exe)
        .args(args)
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .spawn()
        .map_err(|e| anyhow!("{}", e))
}

/// on macos it will result in /xyz/chipmunk.app
fn electron_app_path() -> Result<String> {
    let launcher = std::env::current_exe()?;
    // /xyz/chipmunk.app/Contents/MacOS/app
    if cfg!(target_os = "macos") {
        let cropped = launcher
            .parent()
            .and_then(Path::parent)
            .and_then(Path::parent)
            .ok_or_else(|| anyhow!("could not get parent of {:?}", launcher))?;
        Ok(cropped.to_string_lossy().into())
    } else {
        let parrent_path = launcher
            .parent()
            .ok_or_else(|| anyhow!("no parent found"))?
            .to_string_lossy();
        if cfg!(target_os = "windows") {
            Ok(format!("{}\\app.exe", parrent_path))
        } else {
            Ok(format!("{}/app", parrent_path))
        }
    }
}

/// on macos it looks like /xyz/chipmunk.app/Contents/MacOS/app
fn find_electron_app() -> Result<String> {
    let root = std::env::current_exe()?;
    let root_path = Path::new(&root)
        .parent()
        .ok_or_else(|| anyhow!("no parent found"))?;
    let app = if cfg!(target_os = "windows") {
        format!("{}\\{}", root_path.display(), "app.exe")
    } else {
        format!("{}/{}", root_path.display(), "app")
    };
    Ok(app)
}

fn get_updater_path() -> PathBuf {
    let home_dir = dirs::home_dir();
    let updater = format!(
        "{}/.chipmunk/apps/updater",
        home_dir.unwrap().as_path().to_str().unwrap()
    );
    PathBuf::from(if cfg!(target_os = "windows") {
        format!("{}.exe", updater)
    } else {
        updater
    })
}

fn update_package_path() -> String {
    let home_dir = dirs::home_dir();
    let downloads = format!(
        "{}/.chipmunk/downloads",
        home_dir.unwrap().as_path().to_str().unwrap()
    );
    let downloads_path = Path::new(&downloads);
    let mut maxunixts = 0;
    let mut target: String = String::from("");
    for entry in downloads_path
        .read_dir()
        .expect("Fail read downloads folder")
    {
        if let Ok(entry) = entry {
            let path_buf = entry.path();
            let path = Path::new(&path_buf);
            if let Some(ext) = path.extension() {
                if path.is_file() && ext == "tgz" {
                    let metadata = std::fs::metadata(&path).unwrap();
                    if let Ok(time) = metadata.modified() {
                        let unixts = time
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap()
                            .as_secs();
                        if unixts > maxunixts {
                            maxunixts = unixts;
                            let path_str = path.to_str().unwrap();
                            target = path_str.to_string();
                        }
                    } else {
                        warn!("Not supported on this platform");
                    }
                }
            }
        }
    }
    target
}

fn update() -> Result<bool> {
    let updater_path = get_updater_path();

    if !updater_path.exists() {
        error!("File of updater {:?} doesn't exist", updater_path);
        return Ok(false);
    }

    trace!("Starting updater: {:?}", updater_path);
    let app = electron_app_path()?;
    let update_package = update_package_path();
    if app == "" || update_package == "" {
        error!(
            "Fail to start update because some path isn't detected. app: {}, tgz: {}",
            app, update_package
        );
        std::process::exit(0);
    }
    trace!("Detected\n\t-\tapp: {};\n\t-\ttgz: {}", app, update_package);
    let child = spawn(&updater_path.to_string_lossy(), &[&app, &update_package]);
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
    Ok(true)
}

fn main() {
    match init_logging() {
        Ok(()) => trace!("Launcher started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {}", e),
    }

    let electron_app = match find_electron_app() {
        Ok(app) => app,
        Err(e) => {
            error!("path to executable not found: {}", e);
            std::process::exit(1);
        }
    };

    trace!("Target application: {}", electron_app);

    let electron_app_path = Path::new(&electron_app);

    if !electron_app_path.exists() {
        error!("electron app not found! {:?}", electron_app_path);
        std::process::exit(1);
    }

    let mut start_required = true;
    while start_required {
        start_required = false;
        debug!("Starting application: {}", electron_app);

        let child = spawn(&electron_app, &[]);
        match child {
            Ok(mut child) => {
                info!("Electron application is started ({:?})", electron_app_path);
                match child.wait() {
                    Ok(result) => {
                        let exit_code = result.code().unwrap();
                        start_required = handle_exit_code(exit_code)
                    }
                    Err(e) => {
                        error!("Error during running app: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Fail to start app due error: {}", e);
            }
        };
        debug!("start is required: {}", start_required);
    }
    debug!("exiting...start is required: {}", start_required);
}

fn handle_exit_code(exit_code: i32) -> bool {
    trace!("App is finished with code: {}", exit_code);
    match exit_code {
        code if code == ElectronExitCode::NormalExit as i32 => {
            // node app was closed
            info!("No update required, exiting");
        }
        code if code == ElectronExitCode::UpdateRequired as i32 => {
            // node app was closed and update requested
            info!("Update is required");
            match update() {
                Ok(res) => debug!("updated finished {} OK", if res { "" } else { "not" }),
                Err(e) => error!("update failed: {}", e),
            }
        }
        code if code == ElectronExitCode::RestartRequired as i32 => {
            // node app was closed and but needs a restart
            info!("Restart is required");
            return true;
        }
        code => {
            warn!("received unknown exit code {}! exiting...", code);
        }
    }
    false
}
