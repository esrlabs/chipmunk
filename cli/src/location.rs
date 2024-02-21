use git2::Repository;

use crate::LOCATION;
use std::path::Path;
use std::{
    env::current_dir,
    io::{Error, ErrorKind},
    path::PathBuf,
};

#[derive(Clone, Debug)]
pub struct Location {
    pub root: PathBuf,
}

impl Location {
    pub fn new() -> Result<Location, Error> {
        let current_dir = current_dir()?;
        let root: PathBuf = match Repository::discover(current_dir) {
            Ok(repo) => {
                let Some(root) = repo.workdir() else {
                    return Err(Error::new(
                        ErrorKind::NotFound,
                        "Fail to find project's root location",
                    ));
                };

                root.into()
            }
            Err(err) => return Err(Error::new(ErrorKind::NotFound, err)),
        };

        // Make sure we are in the chipmunk repository
        // Note: This check will fail if the structure of the repo changes
        if root.join("application").is_dir() && root.join("developing").is_dir() {
            Ok(Self { root })
        } else {
            Err(Error::new(
                ErrorKind::NotFound,
                "Fail to find project's root location",
            ))
        }
    }
}

pub fn to_relative_path(path: &PathBuf) -> &Path {
    path.strip_prefix(&LOCATION.root).unwrap_or(path)
}
