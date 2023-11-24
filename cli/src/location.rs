use crate::LOCATION;
use std::ffi::OsStr;
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
        let mut len = root.iter().collect::<Vec<&OsStr>>().len();
        loop {
            if len == 0 {
                return Err(Error::new(
                    ErrorKind::NotFound,
                    "Fail to find ICSMW location",
                ));
            }
            // TODO: better compare folders stucts or some file, like some git config file
            if root.ends_with("chipmunk") || root.ends_with("logviewer") {
                break;
            }
            if len > 0 {
                len = len.saturating_sub(1);
            }
            root.pop();
        }
        Ok(Self { root })
    }
}

pub fn to_relative_path(path: PathBuf) -> String {
    let path_str = path.to_string_lossy().to_string();
    path_str.replace(&LOCATION.root.to_string_lossy().to_string(), "")
}
