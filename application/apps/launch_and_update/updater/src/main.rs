#[macro_use]
extern crate log;
extern crate log4rs;

use anyhow::{anyhow, Result};
use base::initialize_from_fresh_yml;
use base::util::*;
use std::env::current_dir;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};

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

    if args.len() != 2 {
        Err(anyhow!("Expecting 2 arguments"))
    } else {
        Ok((
            PathBuf::from(args[0].to_string()),
            PathBuf::from(args[1].to_string()),
        ))
    }
}

/// remove old version of the application but keep a backup
/// returns the path of the old application folder and the path to the backup tarball
fn remove_old_application(app_folder: &Path) -> Result<PathBuf> {
    debug!("This folder will be cleaned: {:?}", app_folder);
    if cfg!(target_os = "macos") {
        // Mac doesn't require any specific actions, because all are in self-compressed folder "chipmunk.app"
        std::fs::remove_dir_all(&app_folder)?;
        let dest = app_folder
            .parent()
            .ok_or_else(|| anyhow!("parent folder not found"))?;
        Ok(PathBuf::from(dest))
    } else {
        // Try to read release-file
        match collect_release_files(&app_folder) {
            None => {
                // File ".release" doesn't exist (for example because it's version < 1.20.14)
                // or there are some reading error. In any way continue with removing whole folder
                // DANGEROUS oparation! Should be deprecated from 1.3.x
                if let Err(err) = std::fs::remove_dir_all(&app_folder) {
                    error!("Unable to delete entry {:?}: {}", app_folder, err);
                    if cfg!(target_os = "windows") {
                        warn!("Continue process even with previos error.");
                    } else {
                        return Err(anyhow!("Unable to delete entry {:?}: {}", app_folder, err));
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

fn restart_app(app: &Path, tgz: &Path) -> Result<()> {
    let to_be_started: PathBuf = if cfg!(target_os = "macos") {
        app.to_path_buf().join("Contents/MacOS/chipmunk")
    } else {
        app.to_path_buf()
    };
    info!("restarting app: {:?}", to_be_started);

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
    match initialize_from_fresh_yml() {
        Ok(()) => trace!("=======> Updater started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {}", e),
    }
    debug!("Started");

    // on macos the current_app_path will be something like /xyz/chipmunk.app
    let (current_app_path, compressed_update_path) = match extract_args() {
        Ok(res) => res,
        Err(e) => {
            error!(
                "Argument error: {:?}, expected [current app path] and [update tgz file]",
                e
            );
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

    let app_folder = if cfg!(target_os = "macos") {
        current_app_path.clone() // is equals to chipmunk.app
    } else {
        current_app_path
            .clone()
            .parent()
            .expect("could not get parent-directory of application")
            .to_path_buf()
    };

    info!("create backup for current app folder: {:?}", app_folder);
    let backup = tarball_app(&app_folder, &current_dir().expect("could not get pwd"))
        .expect("could not create backup");

    info!("removing old application {:?}", app_folder);
    let dest = match remove_old_application(&app_folder) {
        Ok(res) => res,
        Err(e) => {
            error!("removing application folder failed: {:?}", e);
            std::process::exit(1);
        }
    };

    info!(
        "unpacking update package{:?} to {:?}",
        compressed_update_path, dest
    );
    if let Err(e) = unpack(&compressed_update_path, &dest) {
        error!("unpacking failed: {}", e);
        match remove_entity(&dest) {
            Ok(()) => match unpack(&backup, &dest) {
                Ok(()) => {
                    info!("rollback was done");
                    let _ = remove_entity(&backup);
                }
                Err(e) => {
                    error!("rollback was not possible: {}", e);
                    std::process::exit(1);
                }
            },
            Err(e) => {
                error!("rollback unsuccessful: {}", e);
                std::process::exit(1);
            }
        }
    }
    debug!("unpacked update to {:?}", dest);

    match restart_app(&current_app_path, &compressed_update_path) {
        Err(e) => error!("restart failed: {}", e),
        Ok(()) => info!("restarted successfully"),
    }
    info!("updater terminated");
}
