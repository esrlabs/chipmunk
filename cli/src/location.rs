use anyhow::{bail, Context, Error};
use git2::Repository;

use std::path::Path;
use std::{env::current_dir, path::PathBuf};

use tokio::sync::OnceCell;

pub static LOCATION: OnceCell<Location> = OnceCell::const_new();

#[derive(Clone, Debug)]
pub struct Location {
    pub root: PathBuf,
}

impl Location {
    pub fn new() -> Result<Location, Error> {
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
        .expect("Location is initialized in main function")
        .root
}

/// Initial location instance to get the path of the root repository
/// return `Error` If the program isn't invoked inside chipmunk repository
pub fn init_location() -> Result<(), Error> {
    assert!(LOCATION.get().is_none());

    let location = Location::new()?;
    LOCATION
        .set(location)
        .expect("init location can't be called more than once");
    Ok(())
}

pub fn to_relative_path(path: &PathBuf) -> &Path {
    let root = get_root();
    path.strip_prefix(root).unwrap_or(path)
}
