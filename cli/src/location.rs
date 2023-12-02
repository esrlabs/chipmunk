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
        let mut root = current_dir()?;
        // TODO: better compare folders stucts or some file, like some git config file
        while !root.ends_with("chipmunk") && !root.ends_with("logviewer") {
            if !root.pop() {
                return Err(Error::new(
                    ErrorKind::NotFound,
                    "Fail to find project's root location",
                ));
            }
        }

        Ok(Self { root })
    }
}

pub fn to_relative_path(path: &PathBuf) -> &Path {
    path.strip_prefix(&LOCATION.root).unwrap_or(path)
}
