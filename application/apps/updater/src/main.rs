extern crate chrono;
extern crate dirs;
extern crate flate2;
extern crate tar;
#[macro_use]
extern crate log;
extern crate log4rs;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use flate2::read::GzDecoder;
use log::LevelFilter;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Config, Root};
use log4rs::encode::pattern::PatternEncoder;
use std::fs::File;
use std::io::{Error, ErrorKind, Result};
use std::path::Path;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::{thread, time};
use tar::Archive;

fn init_logging() {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_path = home_dir.join(".logviewer").join("chipmunk.updater.log");
    let appender_name = "updater-root";
    let logfile = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d} - {l}:: {m}\n")))
        .build(log_path)
        .unwrap();

    let config = Config::builder()
        .appender(Appender::builder().build(appender_name, Box::new(logfile)))
        .build(
            Root::builder()
                .appender(appender_name)
                .build(LevelFilter::Trace),
        )
        .unwrap();

    log4rs::init_config(config).unwrap();
}

fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe).args(args).spawn()
}

fn extract_args() -> Result<(String, String)> {
    let mut args = Vec::new();

    trace!("Parsing arguments");
    for arg in std::env::args().skip(1) {
        args.push(arg);
    }

    trace!("Next arguments are parsered {:?}", args);
    if args.len() != 2 {
        Err(Error::new(ErrorKind::Other, "Expecting 2 arguments"))
    } else {
        Ok((args[0].to_string(), args[1].to_string()))
    }
}
fn remove_application_folder(app: &Path) -> Result<PathBuf> {
    let to_be_removed = if cfg!(target_os = "macos") {
        app
    } else {
        app.parent().unwrap()
    };

    debug!("Next: this folder will be removed: {:?}", to_be_removed);

    if let Err(err) = std::fs::remove_dir_all(&to_be_removed) {
        error!("Unable to delete directory {:?}: {}", to_be_removed, err);
        if cfg!(target_os = "windows") {
            warn!("Continue process even with previos error.");
        } else {
            error!("Cannot continue updating. Process is stopped.");
            std::process::exit(1);
        }
    }

    let dest = if cfg!(target_os = "macos") {
        to_be_removed.parent().unwrap()
    } else {
        to_be_removed
    };
    Ok(PathBuf::from(dest))
}
fn unpack(tgz: &Path, dest: &PathBuf) -> Result<()> {
    // Unpack
    info!("File {:?} will be unpacked into {:?}", tgz, dest);

    let tar_gz = match File::open(&tgz) {
        Err(e) => {
            error!("Fail to open file due error: {}", e);
            std::process::exit(1);
        }
        Ok(file) => file,
    };
    let tar = GzDecoder::new(tar_gz);
    let mut archive = Archive::new(tar);
    match archive.unpack(&dest) {
        Err(e) => {
            error!("Fail to unpack file due error: {}", e);
            std::process::exit(1);
        }
        Ok(file) => file,
    };

    info!(
        "File {} is unpacked into {}",
        tgz.to_string_lossy(),
        dest.to_string_lossy()
    );
    Ok(())
}
fn restart_app(app: &Path, tgz: &Path) -> Result<()> {
    let to_be_started: PathBuf = if cfg!(target_os = "macos") {
        app.to_path_buf().join("Contents/MacOS/chipmunk")
    } else {
        app.to_path_buf()
    };

    if !to_be_started.exists() {
        error!(
            "Failed to find executable file {}",
            to_be_started.to_string_lossy()
        );
        Err(Error::new(
            ErrorKind::Other,
            "Failed to restart, couldn't find executable file",
        ))
    } else {
        debug!("Remove tgz: {:?}", tgz);
        if let Err(err) = std::fs::remove_file(&tgz) {
            warn!(
                "Fail to remove file {} due error {}",
                tgz.to_string_lossy(),
                err
            );
        }
        info!("Starting: {:?}", &to_be_started);
        let child = spawn(to_be_started.to_str().unwrap(), &[]);
        match child {
            Ok(mut child) => {
                info!("App is started ({:?})", to_be_started);
                match child.wait() {
                    Ok(result) => {
                        info!("App is finished: {}", result);
                    }
                    Err(e) => {
                        error!("Error during running app: {}", e);
                    }
                }
                Ok(())
            }
            Err(e) => {
                error!("Fail to start app due error: {}", e);
                Err(Error::new(
                    ErrorKind::Other,
                    format!("Fail to start app due error: {}", e),
                ))
            }
        }
    }
}
fn main() {
    init_logging();
    debug!("Started");

    let (app_arg, tgz_arg) = match extract_args() {
        Ok(res) => res,
        Err(e) => {
            error!("Argument error: {:?}", e);
            std::process::exit(1);
        }
    };
    let app = Path::new(app_arg.as_str());
    let tgz = Path::new(tgz_arg.as_str());

    // Check paths
    if !app.exists() {
        error!("File {:?} doesn't exist", app);
        std::process::exit(1);
    }

    if !tgz.exists() {
        error!("File {:?} doesn't exist", tgz);
        std::process::exit(1);
    }

    // Sleep a little bit to give possibility chipmunk to be closed
    thread::sleep(time::Duration::from_millis(2000));

    let dest = match remove_application_folder(&app) {
        Ok(res) => res,
        Err(e) => {
            error!("removing application folder failed: {:?}", e);
            std::process::exit(1);
        }
    };

    if let Err(e) = unpack(&tgz, &dest) {
        error!("unpacking failed: {}", e);
        // TODO implement rollback
        std::process::exit(1);
    }

    match restart_app(&app, &tgz) {
        Err(e) => error!("restart failed: {}", e),
        Ok(()) => info!("restarted successfully"),
    }
}
