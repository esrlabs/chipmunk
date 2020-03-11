extern crate chrono;
extern crate dirs;
extern crate flate2;
extern crate tar;
#[macro_use]
extern crate log;
extern crate log4rs;

use anyhow::anyhow;
use anyhow::Result;
use flate2::read::GzDecoder;
use log::LevelFilter;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Config, Root};
use log4rs::encode::pattern::PatternEncoder;
use std::fs::File;
use std::path::Path;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::{thread, time};
use tar::Archive;

const RELEASE_FILE_NAME: &str = ".release";

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

fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe)
        .args(args)
        .spawn()
        .map_err(|e| anyhow!("could not spawn {} as a process ({})", exe, e))
}

fn extract_args() -> Result<(PathBuf, PathBuf)> {
    let mut args = Vec::new();

    trace!("Parsing arguments");
    for arg in std::env::args().skip(1) {
        args.push(arg);
    }

    trace!("Next arguments are parsered {:?}", args);
    if args.len() != 2 {
        Err(anyhow!("Expecting 2 arguments"))
    } else {
        Ok((
            PathBuf::from(args[0].to_string()),
            PathBuf::from(args[1].to_string()),
        ))
    }
}

fn get_release_files(app: &Path) -> Option<Vec<String>> {
    let release_file: PathBuf = app.to_path_buf().join(RELEASE_FILE_NAME);
    if !release_file.exists() {
        warn!("Fail to find release file {:?}", release_file);
        return None;
    }
    match std::fs::read_to_string(&release_file) {
        Err(e) => {
            error!("Error to read file {:?}: {}", release_file, e);
            None
        }
        Ok(content) => Some(content.lines().map(|s| s.to_string()).collect()),
    }
}

fn remove_entity(entity: &Path) -> Result<()> {
    if !entity.exists() {
        return Ok(());
    }
    if entity.is_dir() {
        std::fs::remove_dir_all(&entity)?;
    } else if entity.is_file() {
        std::fs::remove_file(&entity)?;
    }
    Ok(())
}

fn remove_old_application(app: &Path) -> Result<PathBuf> {
    let app_folder = if cfg!(target_os = "macos") {
        app // is equals to chipmunk.app
    } else {
        app.parent()
            .ok_or_else(|| anyhow!("could not get parent of {:?}", app))?
    };

    debug!("This folder will be cleaned: {:?}", app_folder);
    if cfg!(target_os = "macos") {
        // Mac doesn't requere any specific actions, because all are in self-compressed folder "chipmunk.app"
        std::fs::remove_dir_all(&app_folder)?;
        let dest = app_folder
            .parent()
            .ok_or_else(|| anyhow!("parent folder not found"))?;
        Ok(PathBuf::from(dest))
    } else {
        // Try to read release-file
        match get_release_files(&app_folder) {
            None => {
                // File ".release" doesn't exist (for example because it's version < 1.20.14)
                // or there are some reading error. In any way continue with removing whole folder
                // DANGEROUS oparation! Should be deprecated from 1.3.x
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
                        remove_entity(&path)?;
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

    let tar_gz = File::open(&tgz)?;
    let tar = GzDecoder::new(tar_gz);
    let mut archive = Archive::new(tar);
    archive.unpack(&dest)?;

    info!("File {:?} was unpacked into {:?}", tgz, dest);
    Ok(())
}

fn restart_app(app: &Path, tgz: &Path) -> Result<()> {
    let to_be_started: PathBuf = if cfg!(target_os = "macos") {
        app.to_path_buf().join("Contents/MacOS/chipmunk")
    } else {
        app.to_path_buf()
    };

    if !to_be_started.exists() {
        error!("Failed to find executable file {:?}", to_be_started);
        Err(anyhow!("Failed to restart, couldn't find executable file"))
    } else {
        debug!("Remove tgz: {:?}", tgz);
        if let Err(err) = std::fs::remove_file(&tgz) {
            warn!("Fail to remove file {:?} due error {}", tgz, err);
        }
        info!("Starting: {:?}", &to_be_started);
        let child = spawn(
            to_be_started
                .to_str()
                .expect("process for starting could not be spawned"),
            &[],
        );
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
                Err(anyhow!("Fail to start app due error: {}", e))
            }
        }
    }
}
fn main() {
    match init_logging() {
        Ok(()) => trace!("Updater started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {}", e),
    }
    debug!("Started");

    let (current_app_path, compressed_update_path) = match extract_args() {
        Ok(res) => res,
        Err(e) => {
            error!("Argument error: {:?}", e);
            std::process::exit(1);
        }
    };

    // Check paths
    if !current_app_path.exists() {
        error!("File {:?} doesn't exist", current_app_path);
        std::process::exit(1);
    }

    if !compressed_update_path.exists() {
        error!("File {:?} doesn't exist", compressed_update_path);
        std::process::exit(1);
    }

    // Sleep a little bit to give possibility chipmunk to be closed
    thread::sleep(time::Duration::from_millis(2000));

    let dest = match remove_old_application(&current_app_path) {
        Ok(res) => res,
        Err(e) => {
            error!("removing application folder failed: {:?}", e);
            std::process::exit(1);
        }
    };

    if let Err(e) = unpack(&compressed_update_path, &dest) {
        error!("unpacking failed: {}", e);
        // TODO implement rollback
        std::process::exit(1);
    }

    match restart_app(&current_app_path, &compressed_update_path) {
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
            Err(e) => println!("Error {}", e),
            Ok(exe_path) => {
                let relative_path: &str = "application/apps/updater";
                println!("App is running with {}", exe_path.display());
                let parts: Vec<&str> = exe_path
                    .to_str()
                    .expect("exe path invalid")
                    .split(relative_path)
                    .collect();
                assert_eq!(parts.len(), 2);
                let test_folder = Path::new(&parts[0]).join(format!("{}/tests", relative_path));
                println!("Parent folder of path is {}", test_folder.display());
                match get_release_files(&test_folder) {
                    None => {
                        println!("Fail get list");
                    }
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
            Err(e) => println!("Error {}", e),
            Ok(exe_path) => {
                let relative_path: &str = "application/apps/updater";
                println!("App is running with {}", exe_path.display());
                let parts: Vec<&str> = exe_path
                    .to_str()
                    .expect("exe path invalid")
                    .split(relative_path)
                    .collect();
                assert_eq!(parts.len(), 2);
                let test_folder = Path::new(&parts[0]).join(format!("{}/tests", relative_path));
                println!("Parent folder of path is {}", test_folder.display());
                // if let Err(e) = remove_application_folder(&test_folder) {
                //     println!("here..........................{}", e);
                // }
            }
        }
    }
}
