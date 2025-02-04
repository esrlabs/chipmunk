//! Manages finding the root of Chipmunk repository to make it possible to call the app from
//! anywhere within the repo and exit early if the CLI tool is invoked form outside of the repo.

use anyhow::{bail, Context, Error};
use git2::Repository;

use std::{env::current_dir, path::PathBuf, sync::OnceLock};

use crate::target::Target;

pub static LOCATION: OnceLock<Location> = OnceLock::new();

#[derive(Clone, Debug)]
pub struct Location {
    pub root: PathBuf,
}

impl Location {
    fn new() -> Result<Location, Error> {
        let current_dir = current_dir()?;
        let repo =
            Repository::discover(current_dir).context("Fail to find chipmunk root directory")?;
        let Some(root) = repo.workdir() else {
            bail!("Fail to find chipmunk root directory")
        };

        // Make sure we are in the chipmunk repository
        // Note: This check will fail if the structure of the repo changes
        if root.join("application").is_dir() && root.join("developing").is_dir() {
            Ok(Self { root: root.into() })
        } else {
            bail!("Fail to find project's root location")
        }
    }
}

/// Get the path of the root repository
pub fn get_root() -> &'static PathBuf {
    &LOCATION
        .get()
        .expect("Developer Error: Location is initialized in main function")
        .root
}

/// Initial location instance to get the path of the root repository
/// return `Error` If the program isn't invoked inside chipmunk repository
pub fn init_location() -> Result<(), Error> {
    assert!(LOCATION.get().is_none());

    let location = Location::new()?;
    LOCATION
        .set(location)
        .expect("Developer Error: init location can't be called more than once");
    Ok(())
}

/// Return the path for the configuration directory of the Build CLI Tool.
pub fn config_path() -> PathBuf {
    Target::CliDev.cwd().join("config")
}

/// Return the path for the home directory directory where logs and configuration are placed.
pub fn chipmunk_home_dir() -> anyhow::Result<PathBuf> {
    let home_dir = dirs::home_dir()
        .map(|home| home.join(".chipmunk"))
        .context("Resolving home directory failed")?;

    Ok(home_dir)
}

/// Return the path for the build CLI directory in Chipmunk home directory.
pub fn build_cli_home_dir() -> anyhow::Result<PathBuf> {
    let chipmunk_home =
        chipmunk_home_dir().context("Error while resolving Chipmunk home directory")?;
    const BUILD_CLI_DIR_NAME: &str = "build_cli";
    let build_cli_path = chipmunk_home.join(BUILD_CLI_DIR_NAME);

    Ok(build_cli_path)
}
