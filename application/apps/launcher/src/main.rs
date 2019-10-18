#![windows_subsystem = "windows"]

extern crate chrono;
extern crate dirs;
extern crate flate2;
#[macro_use]
extern crate log;
extern crate log4rs;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use log::LevelFilter;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Config, Root};
use log4rs::encode::pattern::PatternEncoder;
use regex::Regex;
use std::io::{Error, ErrorKind, Result};
use std::path::Path;
use std::process::Child;
use std::process::Command;
use std::time::SystemTime;

fn init_logging() -> Result<()> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_path = home_dir.join(".logviewer").join("chipmunk.launcher.log");
    let appender_name = "launcher-root";
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
        .unwrap();

    log4rs::init_config(config).unwrap();

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe).args(args).spawn()
}

#[cfg(target_os = "windows")]
fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    const DETACHED_PROCESS: u32 = 0x00000008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
    Command::new(exe)
        .args(args)
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .spawn()
}

/// get the path of the
fn get_app_path_str() -> Result<String> {
    let launcher = std::env::current_exe()?;
    let launcher_str = launcher
        .to_str()
        .ok_or_else(|| Error::new(ErrorKind::Other, "could not convert path to string"))?;
    let launcher_path = Path::new(&launcher);
    if cfg!(target_os = "macos") {
        let re = Regex::new(r"chipmunk\.app.*").unwrap();
        let cropped = re.replace_all(launcher_str, "chipmunk.app").to_string();
        trace!("cropped: {}", cropped);
        let cropped_path = Path::new(&cropped);
        if !cropped_path.exists() {
            error!("Fail to find application by next path: {:?}", cropped_path);
            trace!("Closing launcher");
            std::process::exit(1);
        }
        Ok(cropped)
    } else {
        let parrent_path = launcher_path
            .parent()
            .ok_or_else(|| Error::new(ErrorKind::Other, "no parent found"))?
            .to_string_lossy();
        if cfg!(target_os = "windows") {
            Ok(format!("{}\\app.exe", parrent_path))
        } else {
            Ok(format!("{}/app", parrent_path))
        }
    }
}

fn get_exe_path() -> Result<String> {
    let root = std::env::current_exe()?;
    let root_path = Path::new(&root)
        .parent()
        .ok_or_else(|| Error::new(ErrorKind::Other, "no parent found"))?;
    let app = if cfg!(target_os = "windows") {
        format!("{}\\{}", root_path.display(), "app.exe")
    } else {
        format!("{}/{}", root_path.display(), "app")
    };
    Ok(app)
}

fn get_updater_path() -> String {
    let home_dir = dirs::home_dir();
    let updater = format!(
        "{}/.logviewer/apps/updater",
        home_dir.unwrap().as_path().to_str().unwrap()
    );
    if cfg!(target_os = "windows") {
        format!("{}.exe", updater)
    } else {
        updater
    }
}

fn get_app_updating_tgz_path_str() -> String {
    let home_dir = dirs::home_dir();
    let downloads = format!(
        "{}/.logviewer/downloads",
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
                        println!("Not supported on this platform");
                    }
                }
            }
        }
    }
    target
}

fn update() -> Result<bool> {
    let updater = get_updater_path();
    let updater_path = Path::new(&updater);

    if !updater_path.exists() {
        error!(
            "File of updater {} doesn't exist",
            updater_path.to_string_lossy()
        );
        return Ok(false);
    }

    trace!("Starting updater: {}", updater);
    let app = get_app_path_str()?;
    let tgz = get_app_updating_tgz_path_str();
    if app == "" || tgz == "" {
        error!(
            "Fail to start update because some path isn't detected. app: {}, tgz: {}",
            app, tgz
        );
        std::process::exit(0);
    }
    trace!("Detected\n\t-\tapp: {};\n\t-\ttgz: {}", app, tgz);
    let child = spawn(&updater_path.to_string_lossy(), &[&app, &tgz]);
    match child {
        Ok(_child) => {
            debug!("Updater is started ({})", updater_path.to_string_lossy());
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
        Ok(()) => trace!("Started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {}", e),
    }

    let node_app = match get_exe_path() {
        Ok(app) => app,
        Err(e) => {
            error!("path to executable not found: {}", e);
            std::process::exit(1);
        }
    };

    trace!("Target application: {}", node_app);

    let app_path = Path::new(&node_app);

    if !app_path.exists() {
        error!("File {} doesn't exist", app_path.to_str().unwrap());
        std::process::exit(1);
    }

    debug!("Starting application: {}", node_app);

    let child = spawn(&node_app, &[]);
    match child {
        Ok(mut child) => {
            debug!("Application is started ({})", app_path.to_str().unwrap());
            match child.wait() {
                Ok(result) => {
                    let code = result.code().unwrap();
                    trace!("App is finished with code: {}", code);
                    if code == 0 {
                        // node app was closed
                        trace!("Everything looks good.");
                    } else if code == 131 {
                        // node app was closed and update requested
                        debug!("Update is required");
                        match update() {
                            Ok(res) => {
                                debug!("updated finished {} OK", if res { "" } else { "not" })
                            }
                            Err(e) => error!("update failed: {}", e),
                        }
                    }
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
}
