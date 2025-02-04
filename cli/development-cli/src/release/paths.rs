//! Manage resolving and providing the needed paths for the release job.

use std::path::PathBuf;

use crate::target::Target;

use super::env_utls::is_arm_archit;

/// Provides the full path of the release directory for App target.
pub fn release_path() -> PathBuf {
    Target::App.cwd().join("release")
}

/// Provides the full path of the bin directory in release directory.
pub fn release_bin_path() -> PathBuf {
    release_path().join(release_bin_dir())
}

/// Provides the name of the bin directory inside the release directory on current platform.
fn release_bin_dir() -> &'static str {
    let is_arm = is_arm_archit();
    if cfg!(target_os = "linux") {
        if is_arm {
            "linux-arm64-unpacked"
        } else {
            "linux-unpacked"
        }
    } else if cfg!(target_os = "macos") {
        if is_arm {
            "mac-arm64/chipmunk.app/Contents/MacOS"
        } else {
            "mac/chipmunk.app/Contents/MacOS"
        }
    } else if cfg!(target_os = "windows") {
        "win-unpacked"
    } else {
        panic!(
            "Unknown target os: {}, Arch: {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    }
}

/// Provides the full path of the build directory in release directory.
pub fn release_build_path() -> PathBuf {
    release_path().join(release_build_dir())
}

/// Provides the name of the build directory inside the release directory on current platform.
pub fn release_build_dir() -> &'static str {
    let is_arm = is_arm_archit();
    if cfg!(target_os = "linux") {
        if is_arm {
            "linux-arm64-unpacked"
        } else {
            "linux-unpacked"
        }
    } else if cfg!(target_os = "macos") {
        if is_arm {
            "mac-arm64"
        } else {
            "mac"
        }
    } else if cfg!(target_os = "windows") {
        "win-unpacked"
    } else {
        panic!(
            "Unknown target os: {}, Arch: {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    }
}
