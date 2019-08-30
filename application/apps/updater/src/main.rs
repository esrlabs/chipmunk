extern crate flate2;
extern crate tar;
extern crate dirs;
extern crate chrono;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use chrono::{Utc};
use std::io::Write;
use std::fs::File;
use std::path::Path;
use std::process::{Command, Child};
use flate2::read::GzDecoder;
use tar::Archive;
use std::{thread, time};
use std::fs::OpenOptions;
use std::io::Error;

fn log(msg: String) {
    let now = Utc::now();
    println!("{}:: {}", now, msg);
    let home_dir = dirs::home_dir();
    let log_file = format!("{}/.logviewer/logviewer.updater.log", home_dir.unwrap().as_path().to_str().unwrap());
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

#[cfg(not(target_os = "windows"))]
fn spawn(exe: &str, args: &[&str]) -> Result<Child, Error> {
    Command::new(exe).args(args).spawn()
}

#[cfg(target_os = "windows")]
fn spawn(exe: &str, args: &[&str]) -> Result<Child, Error> {
    Command::new(exe).args(args).creation_flags(0x00000008 & 0x00000200).spawn()
}

fn main() {

    log(format!("Started"));

    // Extract arguments
    let mut args = Vec::new();

    log(format!("Parsing arguments"));
    
    for arg in std::env::args().skip(1) {
        args.push(arg);
    }

    log(format!("Next arguments are parsered {:?}", args));
    
    if args.len() != 2 {
        log(format!("Expecting 2 arguments"));
        std::process::exit(1);
    }
    
    let app = Path::new(&args[0]);
    let tgz = Path::new(&args[1]);

    // Check paths
    if !app.exists() {
        log(format!("File {} doesn't exist", app.to_str().unwrap()));
        std::process::exit(1);
    }

    if !tgz.exists() {
        log(format!("File {} doesn't exist", tgz.to_str().unwrap()));
        std::process::exit(1);
    }

    // Sleep a little bit to give possibility chipmunk to be closed
    let dealy = time::Duration::from_millis(2000);
    thread::sleep(dealy);

    let to_be_removed;
    // Remove application
    if cfg!(target_os = "macos") {
        to_be_removed = app;
    } else {
        to_be_removed = app.parent().unwrap();
    }

    log(format!("Next folder will be removed: {}", to_be_removed.to_str().unwrap()));

    if let Err(err) = std::fs::remove_dir_all(&to_be_removed) {
        log(format!("Unable to delete directory {}: {}", to_be_removed.display(), err));
        if cfg!(target_os = "windows") {
            log(format!("Continue process event previos error."));
        } else {
            log(format!("Cannot continue updating. Process is stopped."));
            std::process::exit(1);
        }
    }

    let dest;

    if cfg!(target_os = "macos") {
        log(format!("Folder {} is removed", to_be_removed.to_str().unwrap()));
        dest = to_be_removed.parent().unwrap();
    } else {
        if let Err(err) = std::fs::create_dir(&to_be_removed) {
            log(format!("Unable to create directory {}: {}", to_be_removed.display(), err));
            if cfg!(target_os = "windows") {
                log(format!("Continue process event previos error."));
            } else {
                log(format!("Cannot continue updating. Process is stopped."));
                std::process::exit(1);
            }
        }
        log(format!("Folder {} is cleaned", to_be_removed.to_str().unwrap()));
        dest = to_be_removed;
    }

    // Unpack
    log(format!("File {} will be unpacked into {}", tgz.to_str().unwrap(), dest.to_str().unwrap()));

    let tar_gz = match File::open(&tgz) {
        Err(e) => {
            log(format!("Fail to open file due error: {}", e));
            std::process::exit(1);
        }
        Ok(file) => file
    };
    let tar = GzDecoder::new(tar_gz);
    let mut archive = Archive::new(tar);
    match archive.unpack(&dest) {
        Err(e) => {
            log(format!("Fail to unpack file due error: {}", e));
            std::process::exit(1);
        }
        Ok(file) => file
    };

    log(format!("File {} is unpacked into {}", tgz.to_str().unwrap(), dest.to_str().unwrap()));

    // Starting
    let to_be_started;

    if cfg!(target_os = "macos") {
        to_be_started = format!("{}/Contents/MacOS/chipmunk", app.to_str().unwrap());
    } else {
        to_be_started = format!("{}", app.to_str().unwrap());
    }

    let to_be_started_path = Path::new(&to_be_started);
    if !to_be_started_path.exists() {
        log(format!("Fail to find executable file {}", to_be_started));
    } else {
        log(format!("Remove tgz: {}", tgz.to_str().unwrap()));
        if let Err(err) = std::fs::remove_file(&tgz.to_str().unwrap()) {
            log(format!("Fail to remove file {} due error {}", tgz.to_str().unwrap(), err));
        }
        log(format!("Starting: {}", &to_be_started));
        let child = spawn(&to_be_started, &[]);
        match child {
            Ok(mut child) => {
                log(format!("App is started ({})", to_be_started));
                match child.wait() {
                    Ok(result) => {
                        log(format!("App is finished: {}", result));
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

}
