use std::path::PathBuf;

use super::Target;

pub fn get_dist_path(prod: bool) -> PathBuf {
    Target::Client
        .cwd()
        .join("dist")
        .join(if prod { "release" } else { "debug" })
}
