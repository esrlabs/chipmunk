use std::path::PathBuf;

use crate::target::Target;

use super::env_utls::is_arm_archit;

pub fn release_path() -> PathBuf {
    Target::App.cwd().join("release")
}

pub fn release_bin_path() -> PathBuf {
    release_path().join(release_bin_dir())
}

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

pub fn release_resources_dir() -> &'static str {
    let is_arm = is_arm_archit();
    if cfg!(target_os = "linux") {
        if is_arm {
            "linux-arm64-unpacked/Resources"
        } else {
            "linux-unpacked/Resources"
        }
    } else if cfg!(target_os = "macos") {
        if is_arm {
            "mac-arm64/chipmunk.app/Contents/Resources"
        } else {
            "mac/chipmunk.app/Contents/Resources"
        }
    } else if cfg!(target_os = "windows") {
        "win-unpacked/Resources"
    } else {
        panic!(
            "Unknown target os: {}, Arch: {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        );
    }
}
