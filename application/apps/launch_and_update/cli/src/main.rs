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
use base::{chipmunk_log_config, initialize_from_fresh_yml, setup_fallback_logging};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::{Child, Command},
};

use dunce::canonicalize;

fn init_logging() -> Result<()> {
    let log_config_path = chipmunk_log_config();
    let logging_correctly_initialized = if log_config_path.exists() {
        // log4rs.yaml exists, try to parse it
        match log4rs::init_file(&log_config_path, Default::default()) {
            Ok(()) => true,
            Err(e) => {
                eprintln!("problems with existing log config ({}), write fresh", e);
                // log4rs.yaml exists, could not parse it
                initialize_from_fresh_yml().is_ok()
            }
        }
    } else {
        // log4rs.yaml did not exists
        initialize_from_fresh_yml().is_ok()
    };
    if !logging_correctly_initialized {
        setup_fallback_logging()?;
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
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    Command::new(exe)
        .args(args)
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .spawn()
        .map_err(|e| anyhow!("{}", e))
}

/// on macos it looks like /xyz/chipmunk.app/Contents/Resources/app/dist/compiled/apps/cm
fn find_launcher() -> Result<String> {
    let root = std::env::current_exe()?;
    let direct_root = match fs::read_link(Path::new(&root)) {
        Err(_e) => PathBuf::from(&root),
        Ok(link) => link,
    };
    debug!("Link: {:?}", direct_root);
    debug!("Current exe: {}", direct_root.display());
    let root_path = Path::new(&direct_root)
        .parent()
        .ok_or_else(|| anyhow!("no parent found"))?;
    debug!("Root: {}", root_path.display());
    debug!("Args: {:?}", std::env::args());
    let app = if cfg!(target_os = "windows") {
        let path = canonicalize(Path::new(&format!(
            "{}\\..\\..\\..\\..\\..\\{}",
            root_path.display(),
            "chipmunk.exe"
        )))?;
        format!("{}", path.display())
    } else if cfg!(target_os = "macos") {
        let path = Path::new(&format!(
            "{}/../../../../../MacOS/{}",
            root_path.display(),
            "chipmunk"
        ))
        .canonicalize()?;
        format!("{}", path.display())
    } else {
        let path = Path::new(&format!(
            "{}/../../../../../{}",
            root_path.display(),
            "chipmunk"
        ))
        .canonicalize()?;
        format!("{}", path.display())
    };
    Ok(app)
}

fn main() -> Result<()> {
    match init_logging() {
        Ok(()) => trace!("started logging"),
        Err(e) => eprintln!("couldn't initialize logging: {}", e),
    }

    let launcher = match find_launcher() {
        Ok(app) => app,
        Err(e) => {
            error!("path to executable not found: {}", e);
            std::process::exit(1);
        }
    };
    debug!("Target app: {}", launcher);

    let launcher_path = Path::new(&launcher);

    if !launcher_path.exists() {
        error!("launcher not found! {:?}", launcher_path);
        std::process::exit(1);
    }

    let pwd = env::current_dir().expect("Fail to detect current dir");
    let pwd = pwd
        .to_str()
        .expect("Fail to convert current path to OS string");
    debug!("Target pwd: {}", pwd);
    let env_args = env::args().collect::<Vec<String>>();
    let mut args: Vec<&str> = vec!["--pwd", pwd];
    args.append(&mut env_args.iter().map(|a| a.as_ref()).collect::<Vec<&str>>());
    debug!("Startup args: {:?}", args.as_slice());
    let child: Result<Child> = spawn(&launcher, args.as_slice());
    match child {
        Ok(child) => {
            let pid = child.id();
            debug!(" Lancher is started (pid: {})", pid);
        }
        Err(e) => {
            error!(" Failed to start launcher ({})", e);
        }
    };
    Ok(())
}
