import subprocess
from pathlib import Path
from utls import get_root
from datetime import datetime
from typing import Dict

# Build command to be used in all build tests
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

# These paths must exist after build command has been finished.
# The paths are relative starting from `chipmunk_root/application`
APP_PATHS_FOR_BUILD_CHECK = [
    # Core
    "apps/indexer/target",
    # Shared
    "platform/dist",
    "platform/node_modules",
    # Binding
    "apps/rustcore/rs-bindings/dist",
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
    build_paths = [
        application_dir.joinpath(sub_dir) for sub_dir in APP_PATHS_FOR_BUILD_CHECK
    ]
    return build_paths


def _build_general_check():
    """Runs Build command for app targets and checks if all build directories + checksum file are created"""
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

    # Check if all the targets directory exists after running build command.
    print("Checking created directories...")
    for path in get_build_paths(root_dir):
        if not path.exists():
            raise AssertionError(f"Path doesn't exist after build. Path: {path}")

    print("Checking created directories Succeeded")

    # Checksum Records file Checks: File must exist after build,
    # and it must have a more resent modification date compared to before build
    print("Checking Checksum Records file changed...")

    assert (
        checksum_path.exists()
    ), f"Checksum record file doesn't exist after build. File Path: {checksum_path}"

    checksum_modified_after = datetime.fromtimestamp(checksum_path.stat().st_mtime)

    assert (
        checksum_modified_after > checksum_modified_before
    ), f"Checksum file modification date after build isn't greater as before build.\
         Before: {checksum_modified_before} , After: {checksum_modified_after}"
    print("Checking if Checksum Records file changed Succeeded")


############   CHECKSUM RECORDS TESTS    ###########

# Name of the temporary file which will be used for testing if file changes will lead to rebuild
# the direct target and all other targets that depend on here.
# This file should be created then deleted after the test is done.
TEMP_FILE_NAME = "tmp_for_cli_test.txt"

# Content of temporary file for testing checksum checks.
# It should provide a clear message for the users to delete the file if the file somehow didn't
# get deleted after the test has finished.
TEMP_FILE_CONTENT = """This file is created to test the build CLI tool only and it should be deleted after each test.
Please delete this file manually if it still exists after build CLI tests are done, 
and please consider opening an issue if you can reproduce this behavior"""

# Paths of files and directory in platform target and all other targets depending on it.
# The modification date for this files will be read before the checksum test starts, then it will be compared after
# the build command has finished to insure that the those targets have been rebuilt.
APP_PATHS_FOR_CHECKSUM_CHECK = [
    # Shared
    "platform/dist/lib.js",
    # Binding
    "apps/rustcore/rs-bindings/dist/index.node",
    # Wrapper
    "apps/rustcore/ts-bindings/dist/index.js",
    # Client
    "client/dist",
    # App
    "holder/dist/app.js",
]


def _build_checksum_check():
    """!!!This function must run directly after a full build!!!
    It creates a dummy file in platform directory and checks that all dependencies (Binding, Wrapper, Client, App)
    has been newly built
    """
    root_dir = get_root()
    application_dir = root_dir.joinpath("application")

    # Get and validate checksum file
    chksum_file = root_dir.joinpath(CHECKSUM_FILE_NAME)
    assert (
        chksum_file.exists()
    ), f"Checksum File must exist before running checksum tests. File Path: {chksum_file}"

    # Save modification date for build paths before start to compare them later.
    modifi_before_start: Dict[Path, datetime] = {}
    for sub_path in APP_PATHS_FOR_CHECKSUM_CHECK:
        sub_path = application_dir.joinpath(sub_path)
        assert (
            sub_path.exists()
        ), f"Build Path must exist before checksum tests starts. Path {sub_path}"
        modifi_date = datetime.fromtimestamp(sub_path.stat().st_mtime)
        modifi_before_start[sub_path] = modifi_date

    # Define temporary file path in platform directory to insure it will be rebuilt
    # with all other targets depending on it.
    temp_file_path = application_dir.joinpath(f"platform/{TEMP_FILE_NAME}")
    assert (
        not temp_file_path.exists()
    ), f"Temporary file can't exist before checksum test start. File Path: {temp_file_path}"

    try:
        # Create temporary file in platform directory
        with open(temp_file_path, "w") as f:
            f.write(TEMP_FILE_CONTENT)

        # Run build command
        subprocess.run(BUILD_COMMAND, check=True)

        # Compare modification date for involved targets
        for path, modifi_before in modifi_before_start.items():
            modifi_after = datetime.fromtimestamp(path.stat().st_mtime)
            assert (
                modifi_after > modifi_before
            ), f"Target modified date after must be more recent than before.\n\
            Target Path: {path}.\n\
            Before: {modifi_before}, After: {modifi_after}"
    finally:
        # Insure temporary file is deleted
        if temp_file_path.exists():
            temp_file_path.unlink()


################   RUN ALL TESTS   ######################


def run_build_tests():
    print("Running General Checks for Build Command...")
    _build_general_check()
    print("*** General Check for Build Command Succeeded ***")

    print("---------------------------------------------------------------")

    print("Running Checksum Checks for Build Command...")
    _build_checksum_check()
    print("*** Checksum Check for Build Command Succeeded ***")


if __name__ == "__main__":
    run_build_tests()
