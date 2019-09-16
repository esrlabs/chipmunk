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
use std::fs::{File};
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

fn get_release_files(app: &Path) -> Option<Vec<String>> {
    let release_file: PathBuf = app.to_path_buf().join(".release");
    let release_file_path = Path::new(&release_file);
    if !release_file_path.exists() {
        warn!("Fail to find release file {:?}", release_file_path);
        return None;
    }
    let content: String = match std::fs::read_to_string(&release_file_path) {
        Err(e) => {
            error!("Error to read file {:?}: {}", release_file_path, e);
            return None;
        },
        Ok(string) => string,
    };
    let entries: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    Some(entries)
}

fn remove_entity(entity: &Path) -> Result<()> {
    if !entity.exists() {
        return Ok(());
    }
    if entity.is_dir() {
        if let Err(err) = std::fs::remove_dir_all(&entity) {
            error!("Unable to delete directory {:?}: {}", entity, err);
            return Err(err);
        } else {
            debug!("Successfuly removed folder: {:?}", entity);
        }
    } else if entity.is_file() {
        if let Err(err) = std::fs::remove_file(&entity) {
            error!("Unable to delete directory {:?}: {}", entity, err);
            return Err(err);
        } else {
            debug!("Successfuly removed file: {:?}", entity);
        }
    }
    Ok(())
}

fn remove_application_folder(app: &Path) -> Result<PathBuf> {
    let app_folder = if cfg!(target_os = "macos") {
        app
    } else {
        app.parent().unwrap()
    };

    debug!("Next: this folder will be removed: {:?}", app_folder);
    if cfg!(target_os = "macos") {
        // Mac doesn't requere any specific actions, because all are in self-compressed folder "chipmunk.app"
        if let Err(err) = std::fs::remove_dir_all(&app_folder) {
            error!("Cannot continue updating. Unable to delete directory {:?}: {}", app_folder, err);
            std::process::exit(1);
        }
        let dest = app_folder.parent().unwrap();
        Ok(PathBuf::from(dest))
    } else {
        // Try to read release-file
        match get_release_files(&app_folder) {
            None => {
                // File ".release" doesn't exist (for example because it's version < 1.20.14)
                // or there are some reading error. In any way continue with removing whole folder
                // DANGEROUS oparation! Should be depricated from 1.3.x
                if let Err(err) = std::fs::remove_dir_all(&app_folder) {
                    error!("Unable to delete entry {:?}: {}", app_folder, err);
                    if cfg!(target_os = "windows") {
                        warn!("Continue process even with previos error.");
                    } else {
                        error!("Cannot continue updating. Process is stopped.");
                        std::process::exit(1);
                    }
                }
                Ok(PathBuf::from(app_folder))
            }
            Some(entries) => {
                // We have list of release files/folders
                for entity in entries.iter() {
                    let path = app_folder.join(entity);
                    if path.exists() {
                        if let Err(err) = remove_entity(&path) {
                            error!("Unable to delete entry {:?}: {}", path, err);
                            if cfg!(target_os = "windows") {
                                warn!("Continue process even with previos error.");
                            } else {
                                error!("Cannot continue updating. Process is stopped.");
                                std::process::exit(1);
                            }
                        }
                    } else {
                        warn!("Fail to find file: {:?}.", path);
                    }
                }
                Ok(PathBuf::from(app_folder))
            }
        }
    }
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

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;

    #[test]
    fn getting_release_files() {
        match std::env::current_exe() {
            Err(e) => {
                println!("Error {}", e)
            },
            Ok(exe_path) => {
                let relative_path: &str = "application/apps/updater";
                println!("App is running with {}", exe_path.display());
                let parts: Vec<&str> = exe_path.to_str().unwrap().split(relative_path).collect();
                assert_eq!(parts.len(), 2);
                let test_folder = Path::new(&parts[0]).join(format!("{}/tests", relative_path));
                println!("Parent folder of path is {}", test_folder.display());
                match get_release_files(&test_folder) {
                    None => {
                        println!("Fail get list");
                    },
                    Some(entries) => {
                        println!("Next etries are read {:?}", entries);
                        assert_eq!(entries.len(), 4);
                        assert_eq!(entries, ["file_a", "file_b", "file_c", "folder_a"]);
                    }
                }
            }
        }
    }

    #[test]
    fn remove_files() {
        match std::env::current_exe() {
            Err(e) => {
                println!("Error {}", e)
            },
            Ok(exe_path) => {
                let relative_path: &str = "application/apps/updater";
                println!("App is running with {}", exe_path.display());
                let parts: Vec<&str> = exe_path.to_str().unwrap().split(relative_path).collect();
                assert_eq!(parts.len(), 2);
                let test_folder = Path::new(&parts[0]).join(format!("{}/tests", relative_path));
                println!("Parent folder of path is {}", test_folder.display());
                if let Err(e) = remove_application_folder(&test_folder) {
                    println!("Error during removing folder: {}", e);
                }
            }
        }
    }


}