import subprocess
from pathlib import Path
from utls import get_root
from datetime import datetime

BUILD_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "build",
    # Provide app target only and it should pull all other targets expect for build CLI, which isn't
    # possible to build on Windows because it's not allowed to replace a binary while it's running.
    "app",
]

# These paths must exist after build build is done.
# The paths are relative starting from `chipmunk_root/application`
APP_PATHS_TO_CHECK = [
    # Core
    "apps/indexer/target",
    # Shared
    "platform/dist",
    "platform/node_modules",
    # Binding
    "apps/rustcore/rs-bindings/dist",
    # These sub paths must not exist after clean build is done.
    "apps/rustcore/rs-bindings/target",
    # Wrapper
    "apps/rustcore/ts-bindings/dist",
    "apps/rustcore/ts-bindings/node_modules",
    "apps/rustcore/ts-bindings/src/native/index.node",
    # Wasm
    "apps/rustcore/wasm-bindings/pkg",
    "apps/rustcore/wasm-bindings/node_modules",
    # Client
    "client/dist",
    "client/node_modules",
    # Updater
    "apps/precompiled/updater/target",
    # App
    "holder/dist",
    "holder/node_modules",
]

# The name of the file where the checksum are saved for development build
CHECKSUM_FILE_NAME = ".build_chksum_dev"


def get_build_paths(root_dir: Path) -> list[Path]:
    """Provides the paths for the directories that must be created after running the build command"""
    application_dir = root_dir.joinpath("application")
    build_paths = [application_dir.joinpath(sub_dir) for sub_dir in APP_PATHS_TO_CHECK]
    return build_paths


def run_build_command():
    print("Running build command...")
    root_dir = get_root()
    # The path for the file where build checksums are saved.
    # This file must be written on every call of build.
    checksum_path = root_dir.joinpath(CHECKSUM_FILE_NAME)

    # Get last modification date for checksum file if exists otherwise get minimal date
    checksum_modified_before = (
        datetime.fromtimestamp(checksum_path.stat().st_mtime)
        if checksum_path.exists()
        else datetime.min
    )
    subprocess.run(BUILD_COMMAND, check=True)

    print("Checking created directories...")
    for path in get_build_paths(root_dir):
        if not path.exists():
            raise AssertionError(f"Path doesn't exist after build. Path: {path}")

    print("Checking created directories Succeeded")

    # Checksum Records file Checks: File must exist after build,
    # and it must have a more resent modification date compared to before build
    print("Checking Checksum Records file...")

    assert (
        checksum_path.exists()
    ), f"Checksum record file doesn't exist after build. File Path: {checksum_path}"

    checksum_modified_after = datetime.fromtimestamp(checksum_path.stat().st_mtime)

    assert (
        checksum_modified_after > checksum_modified_before
    ), f"Checksum file modification date after build isn't greater as before build.\
         Before: {checksum_modified_before} , After: {checksum_modified_after}"

    print("Checking Checksum Records file Succeeded")

    # All Done
    print("*** Check for Build Command Succeeded ***")


if __name__ == "__main__":
    run_build_command()
