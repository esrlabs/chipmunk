#[cfg(windows)]
mod commands {
    pub const NPM: &str = "npm.cmd";
    pub const YARN: &str = "yarn.cmd";
}

#[cfg(not(windows))]
mod commands {
    pub const NPM: &str = "npm";
    pub const YARN: &str = "yarn";
}

pub use commands::*;
