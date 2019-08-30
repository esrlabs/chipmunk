extern crate chrono;
extern crate flate2;
extern crate dirs;

use chrono::{Utc};
use std::io::Write;
use std::fs::{File};
use std::path::{Path};
use std::process::{Command, Stdio};
use std::fs::OpenOptions;
use std::os::unix::process::CommandExt;
use std::io::Error;
use std::time::{SystemTime};

fn log(msg: String) {
    let now = Utc::now();
    println!("{}:: {}", now, msg);
    let home_dir = dirs::home_dir();
    let log_file = format!("{}/.logviewer/logviewer.launcher.log", home_dir.unwrap().as_path().to_str().unwrap());
    let log_path = Path::new(&log_file);
    if !log_path.exists() {
        let mut file = match File::create(&log_path) {
            Err(e) => {
                log(format!("Fail to create log file due error: {}", e));
                std::process::exit(1);
            }
            Ok(file) => file
        };
        file.write_all(format!("{}:: {}\n", now, msg).as_bytes()).unwrap();
    } else {
        let mut file = OpenOptions::new()
            .write(true)
            .append(true)
            .open(log_file)
            .unwrap();
        if let Err(e) = writeln!(file, "{}", format!("{}:: {}", now, msg)) {
            writeln!(std::io::stderr(), "{}", format!("Couldn't write to file: {}", e)).unwrap();
        }  
    }
}

fn execute(exe: &str, args: &[&str]) -> Error {
    Command::new(exe).args(args).exec()
}

fn get_app_path_str() -> String {
    let launcher = std::env::current_exe().unwrap();
    let launcher_str = launcher.to_str().unwrap();
    let launcher_path = Path::new(&launcher);
    if cfg!(target_os = "macos") {
        let split = launcher_str.split("chipmunk.app");
        let vec: Vec<&str> = split.collect();
        if vec.len() != 2 {
            log(format!("Fail to find \"chipmunk.app\" in path: {}", launcher_str));
            // std::process::exit(1);
        }
        return format!("{}chipmunk.app", &vec[0]);
    } else if cfg!(target_os = "windows") {
        return format!("{}\\app.exe", launcher_path.parent().unwrap().to_str().unwrap());
    } else {
        return format!("{}/app", launcher_path.parent().unwrap().to_str().unwrap());
    }
}

fn get_exe_path() -> String {
    let root = std::env::current_exe().unwrap();
    let root_path = Path::new(&root).parent().unwrap();
    let app;
    if cfg!(target_os = "windows") {
        app = format!("{}\\{}", root_path.display(), "app.exe");
    } else {
        app = format!("{}/{}", root_path.display(), "app");
    }
    return app;
}

fn get_app_updating_tgz_path_str() -> String {
    let home_dir = dirs::home_dir();
    let downloads = format!("{}/.logviewer/downloads", home_dir.unwrap().as_path().to_str().unwrap());
    let downloads_path = Path::new(&downloads);
    let mut maxunixts = 0;
    let mut target: String = String::from("");
    for entry in downloads_path.read_dir().expect("Fail read downloads folder") {
        if let Ok(entry) = entry {
            let path_buf = entry.path();
            let path = Path::new(&path_buf);
            match path.extension() {
                Some(ext) => {
                    if path.is_file() && ext == "tgz" {
                        let metadata = std::fs::metadata(&path).unwrap();
                        if let Ok(time) = metadata.modified() {
                            let unixts = time.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs();
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

fn update() {

    let home_dir = dirs::home_dir();
    let updater = format!("{}/.logviewer/apps/updater", home_dir.unwrap().as_path().to_str().unwrap());
    let updater_path = Path::new(&updater);

    if !updater_path.exists() {
        log(format!("File of updater {} doesn't exist", updater_path.to_str().unwrap()));
        return;
    }

    log(format!("Starting updater: {}", updater));
    let app = get_app_path_str();
    let tgz = get_app_updating_tgz_path_str();
    if app == "" || tgz == "" {
        log(format!("Fail to start update because some path isn't detected. app: {}, tgz: {}", app, tgz));
        std::process::exit(0);
    }
    log(format!("Detected app: {}, tgz: {}", app, tgz));
    execute(&updater_path.to_str().unwrap(), &[ &app, &tgz]);
    log(format!("Close launcher"));
    std::process::exit(0);
}

fn main() {

    log(format!("Started"));

    let app = get_exe_path();

    log(format!("Target application: {}", app));

    let app_path = Path::new(&app);

    if !app_path.exists() {
        log(format!("File {} doesn't exist", app_path.to_str().unwrap()));
        std::process::exit(1);
    }

    log(format!("Starting application: {}", app));

    let child = Command::new(&app_path)
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn();
    match child {
        Ok(mut child) => {
            log(format!("Application is started ({})", app_path.to_str().unwrap()));
            match child.wait() {
                Ok(result) => {
                    let code = result.code().unwrap();
                    log(format!("App is finished with code: {}", code));
                    if code == 0 {
                        log(format!("Everything looks good."));
                    } else if code == 131 {
                        log(format!("Update is required"));
                        update();
                    }
                }
                Err(e) => {
                    log(format!("Error during running app: {}", e));
                }
            }
        },
        Err(e) => {
            log(format!("Fail to start app due error: {}", e));
        },
    };
}
