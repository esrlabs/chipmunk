#![windows_subsystem = "windows"]

extern crate chrono;
extern crate dirs;
extern crate flate2;

use chrono::Utc;
use regex::Regex;
use std::fs::OpenOptions;
use std::io::Write;
use std::io::{Error, ErrorKind, Result};
use std::path::Path;
use std::process::{Child, Command};
use std::time::SystemTime;

fn log(msg: String) {
    let now = Utc::now();
    println!("{}:: {}", now, msg);
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let app_home_dir = home_dir.join(".logviewer");
    let log_path = app_home_dir.join("logviewer.launcher.log");
    if !app_home_dir.exists() {
        std::fs::create_dir(&app_home_dir).unwrap();
    }
    match OpenOptions::new()
        .write(true)
        .append(true)
        .create(true)
        .open(&log_path)
    {
        Err(e) => {
            log(format!("Fail to create log file due error: {}", e));
            std::process::exit(1);
        }
        Ok(mut file) => match writeln!(file, "{}", format!("{}:: {}", now, msg)) {
            Err(e) => eprintln!("Couldn't write to file: {}", e),
            Ok(_) => (),
        },
    };
}

fn execute(exe: &str, args: &[&str]) -> Result<std::process::ExitStatus> {
    Command::new(exe).args(args).status()
}
fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe).args(args).spawn()
}

fn get_app_path_str() -> Result<String> {
    let launcher = std::env::current_exe()?;
    let launcher_str = launcher
        .to_str()
        .ok_or_else(|| Error::new(ErrorKind::Other, "could not convert path to string"))?;
    let launcher_path = Path::new(&launcher);
    if cfg!(target_os = "macos") {
        let re = Regex::new(r"chipmunk\.app$").expect("needs to compile");
        if !re.is_match(launcher_str) {
            log(format!(
                "Fail to find \"chipmunk.app\" in path: {}",
                launcher_str
            ));
            std::process::exit(1);
        }
        Ok(launcher_str.to_string())
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
    let app;
    if cfg!(target_os = "windows") {
        app = format!("{}\\{}", root_path.display(), "app.exe");
    } else {
        app = format!("{}/{}", root_path.display(), "app");
    }
    return Ok(app);
}

fn get_updater_path() -> String {
    let home_dir = dirs::home_dir();
    let updater = format!(
        "{}/.logviewer/apps/updater",
        home_dir.unwrap().as_path().to_str().unwrap()
    );
    let updater_exe;
    if cfg!(target_os = "windows") {
        updater_exe = format!("{}.exe", updater);
    } else {
        updater_exe = format!("{}", updater);
    }
    return updater_exe;
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
            match path.extension() {
                Some(ext) => {
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
                None => {}
            }
        }
    }
    return target;
}

fn update() -> Result<bool> {
    let updater = get_updater_path();
    let updater_path = Path::new(&updater);

    if !updater_path.exists() {
        log(format!(
            "File of updater {} doesn't exist",
            updater_path.to_string_lossy()
        ));
        return Ok(false);
    }

    log(format!("Starting updater: {}", updater));
    let app = get_app_path_str()?;
    let tgz = get_app_updating_tgz_path_str();
    if app == "" || tgz == "" {
        log(format!(
            "Fail to start update because some path isn't detected. app: {}, tgz: {}",
            app, tgz
        ));
        std::process::exit(0);
    }
    log(format!("Detected app: {}, tgz: {}", app, tgz));
    execute(&updater_path.to_string_lossy(), &[&app, &tgz])?;
    log(format!("Close launcher"));
    std::process::exit(0);
}

fn main() {
    log(format!("Started"));

    let app = match get_exe_path() {
        Ok(app) => app,
        Err(e) => {
            log(format!("path to executable not found: {}", e));
            std::process::exit(1);
        }
    };

    log(format!("Target application: {}", app));

    let app_path = Path::new(&app);

    if !app_path.exists() {
        log(format!("File {} doesn't exist", app_path.to_str().unwrap()));
        std::process::exit(1);
    }

    log(format!("Starting application: {}", app));

    let child = spawn(&app, &[]);
    match child {
        Ok(mut child) => {
            log(format!(
                "Application is started ({})",
                app_path.to_str().unwrap()
            ));
            match child.wait() {
                Ok(result) => {
                    let code = result.code().unwrap();
                    log(format!("App is finished with code: {}", code));
                    if code == 0 {
                        log(format!("Everything looks good."));
                    } else if code == 131 {
                        log(format!("Update is required"));
                        match update() {
                            Ok(res) => log(format!(
                                "updated finished {} OK",
                                if res { "" } else { "not" }
                            )),
                            Err(e) => log(format!("update failed: {}", e)),
                        }
                    }
                }
                Err(e) => {
                    log(format!("Error during running app: {}", e));
                }
            }
        }
        Err(e) => {
            log(format!("Fail to start app due error: {}", e));
        }
    };
}
