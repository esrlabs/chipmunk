#[macro_use]
extern crate log;
extern crate log4rs;

use anyhow::{anyhow, Result};
use base::{initialize_from_fresh_yml, util::*};
use std::{
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    process::{Child, Command},
    thread, time,
};
use regex::Regex;

const PEDNING_CLOSING_APP_TIME_MS: u64 = 3000;
const ATTEMPTS_TO_REMOVE: u8 = 5;
const DEFAULT_MAC_APP_FOLDER: &str = "chipmunk.app";

fn spawn(exe: &str, args: &[&str]) -> Result<Child> {
    Command::new(exe)
        .args(args)
        .spawn()
        .map_err(|e| anyhow!("could not spawn {} as a process ({})", exe, e))
}

fn deserialize_spaces(str: String) -> Result<String> {
    let re = Regex::new(r"%20").map_err(|_| anyhow!("Fail to find symbol [ in arguments"))?;
    Ok(re.replace_all(&str, " ").to_string())
}

fn extract_validated_paths_from_args(args: Vec<String>) -> Result<(PathBuf, PathBuf)> {
    trace!("Parsing arguments");
    let args_as_str = deserialize_spaces(args.join(""))?;
    let from = args_as_str.chars().position(|c| c == '[').ok_or(anyhow!("Fail to find symbol [ in arguments"))?;
    let to = args_as_str.chars().position(|c| c == ']').ok_or(anyhow!("Fail to find symbol ] in arguments"))?;
    let params_as_str = args_as_str[(from + 1)..to].to_string();
    trace!("extracted: {params_as_str}");
    let params = params_as_str.split(";").collect::<Vec<&str>>();
    if params.len() < 2 {
        Err(anyhow!("Expecting at least 2 arguments"))
    } else {
        Ok((PathBuf::from(params[0]),  PathBuf::from(params[1])))
    }
}

/// remove old version of the application but keep a backup
/// returns the path of the old application folder and the path to the backup tarball
fn remove_old_application(
    app_folder: &Path,
    release_files: Option<&Vec<String>>,
) -> Result<PathBuf> {
    info!("will sleep {PEDNING_CLOSING_APP_TIME_MS}ms to let parent app to be closed");
    let waiting = time::Duration::from_millis(PEDNING_CLOSING_APP_TIME_MS);
    thread::sleep(waiting);
    if cfg!(target_os = "macos") {
        // Mac doesn't require any specific actions, because all are in self-compressed folder "chipmunk.app"
        fs::remove_dir_all(app_folder)?;
        let dest = app_folder
            .parent()
            .ok_or_else(|| anyhow!("parent folder not found"))?;
        Ok(PathBuf::from(dest))
    } else {
        match release_files {
            None => {
                // File ".release" doesn't exist (for example because it's version < 1.20.14)
                // or there are some reading error. In any way continue with removing whole folder
                // DANGEROUS oparation! Should be deprecated from 1.3.x
                if let Err(err) = fs::remove_dir_all(app_folder) {
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
                        if let Err(err) = remove_entity(&path) {
                            warn!("Fail to remove entity {}: {err}", path.to_string_lossy());
                            return Err(err);
                        } else {
                            info!("- [removed]: {:?}", path);
                        }
                    } else {
                        warn!("- [not found]: {:?}", path);
                    }
                }
                Ok(PathBuf::from(app_folder))
            }
        }
    }
}

fn restart_app(app: &Path) -> Result<()> {
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
        info!("Starting: {:?}", &to_be_started);
        let child = spawn(
            to_be_started
                .to_str()
                .expect("process for starting could not be spawned"),
            &[],
        );
        if let Err(err) = child {
            error!("Fail to start app due error: {}", err);
            Err(anyhow!("Fail to start app due error: {}", err))
        } else {
            Ok(())
        }
    }
}
fn main() {
    println!("Updating chipmunk...");
    println!("Please do not close this terminal, it will be closed as soon as chipmunk will be updated.");
    match initialize_from_fresh_yml() {
        Ok(()) => trace!("=======> Updater started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {e}"),
    }
    debug!("Started updater");
    // on macos the current_app_path will be something like /xyz/chipmunk.app
    let (current_app_path, compressed_update_path) = match extract_validated_paths_from_args(
        std::env::args().map(|a| a.to_string()).collect::<Vec<String>>()
    )
    {
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
    debug!("to replace: {:?}", current_app_path);
    debug!("new package: {:?}", compressed_update_path);
    let app_folder = if cfg!(target_os = "macos") {
        current_app_path.clone() // is equals to chipmunk.app
    } else {
        current_app_path
            .parent()
            .expect("could not get parent-directory of application")
            .to_path_buf()
    };
    let release_files = collect_release_files(&app_folder);
    let mut attempts: u8 = 0;
    let dest = loop {
        info!(
            "removing old application {:?}; attempt {}",
            app_folder,
            attempts + 1
        );
        match remove_old_application(&app_folder, release_files.as_ref()) {
            Ok(res) => break res,
            Err(e) => {
                attempts += 1;
                error!("attempt {attempts} of removing application failed: {:?}", e);
                if attempts > ATTEMPTS_TO_REMOVE {
                    error!("no more attempts to remove application will be done");
                    std::process::exit(1);
                }
            }
        };
    };
    if let Err(e) = unpack(&compressed_update_path, &dest) {
        error!(
            "unpacking {:?} failed ({}), try to rollback",
            &compressed_update_path, e
        );
    }
    if cfg!(target_os = "macos") {
        if let Some(mac_app_folder_name) = current_app_path.file_name() {
            if mac_app_folder_name != OsStr::new(DEFAULT_MAC_APP_FOLDER) {
                // User renamed chipmunk.app to something else
                info!("Chipmunk application folder had been renamed by user to {}; target folder should be renamed to", mac_app_folder_name.to_string_lossy());
                if let Err(e) = fs::rename(dest.join(DEFAULT_MAC_APP_FOLDER), &current_app_path) {
                    error!("fail to rename updated application folder {e:?}");
                    std::process::exit(1);
                } else {
                    info!("application folder has been renamed");
                }
            }
        } else {
            error!(
                "cannot detect current name of application folder for path {}",
                current_app_path.to_string_lossy()
            );
            std::process::exit(1);
        }
    }
    match restart_app(&current_app_path) {
        Err(e) => error!("restart failed: {}", e),
        Ok(()) => info!("restarted successfully"),
    }
    debug!("Remove file {:?}", compressed_update_path);
    if let Err(err) = fs::remove_file(&compressed_update_path) {
        warn!(
            "Fail to remove file {:?} due error {}",
            compressed_update_path, err
        );
    }
    info!("updater terminated");
}

#[test]
fn test() {
    let args: Vec<String> = vec![
        String::from("some_noise"),
        String::from("[/path/to/current_app;/path/to/disto;123;2333]"),
        String::from("some_noise")
    ];
    let (app, disto) = extract_validated_paths_from_args(args).expect("Argument should be parsed");
    println!("{app:?}");
    println!("{disto:?}");
    assert_eq!(Some("/path/to/current_app"), app.to_str());
    assert_eq!(Some("/path/to/disto"), disto.to_str());

    let args: Vec<String> = vec![
        String::from("some_noise"),
        String::from("[/path with space/to/current app name with space;/path/to/disto with space;123;2333]"),
        String::from("some_noise")
    ];
    let (app, disto) = extract_validated_paths_from_args(args).expect("Argument should be parsed");
    println!("{app:?}");
    println!("{disto:?}");
    assert_eq!(Some("/path with space/to/current app name with space"), app.to_str());
    assert_eq!(Some("/path/to/disto with space"), disto.to_str());
    
    let args: Vec<String> = vec![
        String::from("some_noise"),
        String::from("[C:\\path\\to\\current_app;D:\\path\\to\\disto;123;2333]"),
        String::from("some_noise")
    ];
    let (app, disto) = extract_validated_paths_from_args(args).expect("Argument should be parsed");
    println!("{app:?}");
    println!("{disto:?}");
    assert_eq!(Some("C:\\path\\to\\current_app"), app.to_str());
    assert_eq!(Some("D:\\path\\to\\disto"), disto.to_str());

    let args: Vec<String> = vec![
        String::from("some_noise"),
        String::from("[C:\\path with space\\to another with space\\current app with space;D:\\path with space\\to\\disto;123;2333]"),
        String::from("some_noise")
    ];
    let (app, disto) = extract_validated_paths_from_args(args).expect("Argument should be parsed");
    println!("{app:?}");
    println!("{disto:?}");
    assert_eq!(Some("C:\\path with space\\to another with space\\current app with space"), app.to_str());
    assert_eq!(Some("D:\\path with space\\to\\disto"), disto.to_str());
}