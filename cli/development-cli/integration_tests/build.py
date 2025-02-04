"""
Provides methods to test the Build command and build state records implementation to watch source 
code changes in Chipmunk Build CLI Tool.
"""

from pathlib import Path
from utls import get_root, run_command, print_green_bold, print_blue_bold
from datetime import datetime
from typing import Dict
import platform

#######################################################################
########################   RUN ALL TESTS   ############################
#######################################################################


def run_build_tests():
    """Runs many tests for build command:
    - General Test: General test for build command and the created directories and build record file.
    - Build Records Test: Test how changing files in some target will affect the build on it and other targets depending on it.
    - Reset Build Records Test: Make sure build records file will deleted when the command is called.
    """
    print_blue_bold("Running General Checks for Build Command...")
    _build_general_check()
    print_green_bold("*** General Check for Build Command Succeeded ***")

    print("---------------------------------------------------------------")

    print_blue_bold("Running Build Records Checks for Build Command...")
    _build_states_records_check()
    print_green_bold("*** Build Records Check for Build Command Succeeded ***")

    print("---------------------------------------------------------------")

    print_blue_bold("Running Reset Build Records Command...")
    _run_reset_build_records_command()
    print_green_bold("*** Test Running Reset Build Records Command Succeeded ***")


#######################################################################
################   GENERAL TEST FOR BUILD COMMAND   ###################
#######################################################################

# Build command to be used in general build test
# This command should build all the targets expect the Build CLI Tool
BUILD_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "build",
    # Provide app target only and it should pull all other GUI-app targets expect for build CLI,
    # which isn't possible to build on Windows because it's not allowed to replace a binary while
    # it's running.
    "app",
    # Chipmunk CLI tool isn't included with app target.
    "cli-chipmunk",
]

# These paths must exist after build command has been finished.
# The paths are relative starting from `chipmunk_root`
APP_PATHS_FOR_BUILD_CHECK = [
    # Core
    "application/apps/indexer/target",
    # Shared
    "application/platform/dist",
    "application/platform/node_modules",
    # Protocol
    "application/apps/protocol/pkg",
    # Binding
    "application/apps/rustcore/rs-bindings/dist",
    "application/apps/rustcore/rs-bindings/target",
    # Wrapper
    "application/apps/rustcore/ts-bindings/dist",
    "application/apps/rustcore/ts-bindings/node_modules",
    "application/apps/rustcore/ts-bindings/src/native/index.node",
    # Wasm
    "application/apps/rustcore/wasm-bindings/pkg",
    "application/apps/rustcore/wasm-bindings/node_modules",
    # Client
    "application/client/dist/debug",
    "application/client/node_modules",
    # Updater
    "application/apps/precompiled/updater/target",
    # App
    "application/holder/dist",
    "application/holder/node_modules",
    # Chipmunk CLI
    "cli/chipmunk-cli/target",
]

# The name of the file where the states of the latest build are saved.
BUILD_RECORDS_FILENAME = ".build_last_state"


def get_build_paths(root_dir: Path) -> list[Path]:
    """Provides the paths for the directories that must be created after running the build command"""
    build_paths = [root_dir.joinpath(sub_dir) for sub_dir in APP_PATHS_FOR_BUILD_CHECK]
    return build_paths


def _build_general_check():
    """
    Runs Build command for app targets and checks if all build directories + Last build states records file are created.
    Build command will run with the default arguments regarding the ui and fail-fast
    """
    print("Running build command...")
    root_dir = get_root()
    # The path for the file where build states are saved.
    # This file must be written on every call of build.
    last_build_state_path = root_dir.joinpath(BUILD_RECORDS_FILENAME)

    # Get last modification date for states file if exists otherwise get minimal date
    build_state_modified_before = (
        get_last_modification_date(last_build_state_path)
        if last_build_state_path.exists()
        else datetime.min
    )
    run_command(BUILD_COMMAND)

    # Check if all the targets directory exists after running build command.
    print("Checking created directories...")
    for path in get_build_paths(root_dir):
        if not path.exists():
            raise AssertionError(f"Path doesn't exist after build. Path: {path}")

    print("Checking created directories Succeeded")

    # Build Records file Checks: File must exist after build,
    # and it must have a more resent modification date compared to before build
    print("Checking Build states Records file changed...")

    assert (
        last_build_state_path.exists()
    ), f"Build states record file doesn't exist after build. File Path: {last_build_state_path}"

    build_state_modified_after = get_last_modification_date(last_build_state_path)

    assert (
        build_state_modified_after > build_state_modified_before
    ), f"Build states records file modification date after build isn't greater as before build.\
         Before: {build_state_modified_before} , After: {build_state_modified_after}"
    print("Checking if Build States Records file changed Succeeded")


#######################################################################
###################   LAST BUILD RECORDS TESTS   ######################
#######################################################################

# Name of the temporary file which will be used for testing if file changes will lead to rebuild
# the direct target and all other targets that depend on here.
# This file should be created then deleted after the test is done.
TEMP_FILE_NAME = "tmp_for_cli_test.txt"

# Content of temporary file for testing build records checks.
# It should provide a clear message for the users to delete the file if the file somehow didn't
# get deleted after the test has finished.
TEMP_FILE_CONTENT = """This file is created to test the build CLI tool only and it should be deleted after each test.
Please delete this file manually if it still exists after build CLI tests are done, 
and please consider opening an issue if you can reproduce this behavior"""

# Paths of files and directory in platform target and all other targets depending on it.
# The modification date for this files will be read before the build records test starts, then it will be
# compared after the build command has finished to insure that the those targets have been rebuilt.
INVOLVED_PATHS_BUILD_RECORDS_CHECK = [
    # Shared
    "platform/dist/lib.js",
    # Binding
    "apps/rustcore/rs-bindings/dist/index.node",
    # Wrapper
    "apps/rustcore/ts-bindings/dist/index.js",
    # Client
    "client/dist/debug",
    # App
    "holder/dist/app.js",
]

# Paths of files and directory that must be not changed after running the build with the changes in platform
# The modification date for this files will be read before the build records test starts, then it will be
# compared after the build command has finished to insure that the those targets have not been rebuilt.
PATHS_NON_INVOLVED_BUILD_RECORDS_CHECK = [
    # Core
    "apps/indexer/target",
    # Wasm
    "apps/rustcore/wasm-bindings/pkg",
    # Updater
    "apps/precompiled/updater/target",
]


def get_last_modification_date(path: Path) -> datetime:
    """Gets the last modification date for the given path on different platforms
    On Unix it will return the last time the meta data of the file has been changed
    On Windows it will return the more recent between creating and last modification times
    """
    # Get file stats
    stats = path.stat()

    # On Unix, return the last time any of the file meta data has changed
    if platform.system() != "Windows":
        return datetime.fromtimestamp(stats.st_ctime)

    # On Windows, return the greater of st_mtime and st_birthtime because time information on Windows can be misleading,
    # like it's possible to get a creation time that is more recent than the modification time.
    else:
        most_recent_time = max(
            stats.st_mtime,
            stats.st_birthtime,
        )
        return datetime.fromtimestamp(most_recent_time)


def _build_states_records_check():
    """!!!This function must run directly after a full build!!!
    It creates a dummy file in platform directory and checks that all dependencies (Binding, Wrapper, Client, App)
    has been newly built.
    This runs the build command with the UI option set to "print"
    """
    root_dir = get_root()
    application_dir = root_dir.joinpath("application")

    # Get and validate build states record file
    build_state_file = root_dir.joinpath(BUILD_RECORDS_FILENAME)
    assert (
        build_state_file.exists()
    ), f"Build State Records File must exist before running Build State Records tests. File Path: {build_state_file}"

    # Save modification date for build paths that must change before start to compare them later.
    modifi_involved_before_start: Dict[Path, datetime] = {}
    for sub_path in INVOLVED_PATHS_BUILD_RECORDS_CHECK:
        sub_path = application_dir.joinpath(sub_path)
        assert (
            sub_path.exists()
        ), f"Build Path must exist before build state records tests starts. Path {sub_path}"
        modifi_date = get_last_modification_date(sub_path)
        modifi_involved_before_start[sub_path] = modifi_date

    # Save modification date for build paths that must sta before start to compare them later.
    modifi_non_involved_before_start: Dict[Path, datetime] = {}
    for sub_path in PATHS_NON_INVOLVED_BUILD_RECORDS_CHECK:
        sub_path = application_dir.joinpath(sub_path)
        assert (
            sub_path.exists()
        ), f"Build Path must exist before build state records tests starts. Path {sub_path}"
        modifi_date = get_last_modification_date(sub_path)
        modifi_non_involved_before_start[sub_path] = modifi_date

    # Define temporary file path in platform directory to insure it will be rebuilt
    # with all other targets depending on it.
    temp_file_path = application_dir.joinpath(f"platform/{TEMP_FILE_NAME}")
    assert (
        not temp_file_path.exists()
    ), f"Temporary file can't exist before build state records test start. File Path: {temp_file_path}"

    try:
        # Create temporary file in platform directory
        with open(temp_file_path, "w") as f:
            f.write(TEMP_FILE_CONTENT)

        # Run build command with the UI option to suppress the bars and show the logs once each command finishes.

        print("Running build command with ui option set to 'print'")

        build_cmd = BUILD_COMMAND.copy()
        build_cmd.extend(["-u", "print"])
        run_command(build_cmd)

        # Compare modification date for involved targets on different platforms
        if platform.system() != "Windows":
            # On Unix systems we compare all the involved targets to insure the build records solution is
            # working and to test the build dependencies logic
            for path, modifi_before in modifi_involved_before_start.items():
                modifi_after = get_last_modification_date(path)
                assert (
                    modifi_after > modifi_before
                ), f"Involved target modification date after must be more recent than before.\n\
                Target Path: {path}.\n\
                Before: {modifi_before}, After: {modifi_after}"
        else:
            # On Windows it's enough that only one of the involved target has more recent date
            # because the file system here isn't reliable in delivering the current time of the
            # latest change on a file or directory
            date_changed = False
            for path, modifi_before in modifi_involved_before_start.items():
                modifi_after = get_last_modification_date(path)
                date_changed = modifi_after > modifi_before
                if date_changed:
                    break
            assert (
                date_changed
            ), "None of the involved targets' modification date is more recent than before build"

        # Compare modification date for not involved targets
        for path, modifi_before in modifi_non_involved_before_start.items():
            modifi_after = get_last_modification_date(path)
            assert (
                modifi_after == modifi_before
            ), f"Not involved target modification date must not be changed.\n\
            Target Path: {path}.\n\
            Before: {modifi_before}, After: {modifi_after}"
    finally:
        # Insure temporary file is deleted
        if temp_file_path.exists():
            temp_file_path.unlink()


######################################################################
##################  RESET BUILD RECORDS COMMAND  #####################
######################################################################

RESET_BUILD_RECORDS_COMMAND = ["cargo", "run", "-r", "--", "chipmunk", "reset-records"]


def _run_reset_build_records_command():
    """This test will run reset-records command in development mode, then it insure that
    the records file has been deleted"""

    records_path = get_root().joinpath(BUILD_RECORDS_FILENAME)
    assert (
        records_path.exists()
    ), f"Build state records file must exist before running 'reset-records' command. File Path: {records_path}"

    run_command(RESET_BUILD_RECORDS_COMMAND)

    assert (
        not records_path.exists()
    ), f"Build state records file must not exist after running 'reset-records' command. File Path: {records_path}"

    pass


if __name__ == "__main__":
    run_build_tests()
