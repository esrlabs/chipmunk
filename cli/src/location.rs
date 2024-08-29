//! Manages finding the root of Chipmunk repository to make it possible to call the app from
//! anywhere within the repo and exit early if the CLI tool is invoked form outside of the repo.

use anyhow::{bail, Context, Error};
use git2::Repository;

use std::{env::current_dir, path::PathBuf, sync::OnceLock};

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
