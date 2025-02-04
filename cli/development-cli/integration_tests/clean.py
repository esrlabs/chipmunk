"""
Provides methods to test the Clean command in Chipmunk Build CLI Tool
Clean command will be invoked here for all targets but the CLI tool itself,
then it checks that all the paths that must be removed don't exist anymore.
Clean command will run in the UI mode "immediate"
"""

from pathlib import Path
from utls import run_command, print_blue_bold, print_green_bold, get_root

CLEAN_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "clean",
    # We need to set targets explicitly because we need to clean everything expect the build CLI tools
    # binaries to avoid failing on Windows when CLI tool tries to remove it's own binary.
    "core",
    "shared",
    "protocol",
    "binding",
    "wrapper",
    "wasm",
    "client",
    "updater",
    "app",
    "cli-chipmunk",
    # Set UI mode to immediate.
    "-u",
    "immediate",
]

# These paths must not exist after clean build is done.
# The paths are relative starting from `chipmunk_root`
PATHS_TO_CHECK = [
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
    "application/apps/rustcore/ts-bindings/spec/build",
    "application/apps/rustcore/ts-bindings/src/native/index.node",
    # Wasm
    "application/apps/rustcore/wasm-bindings/pkg",
    "application/apps/rustcore/wasm-bindings/node_modules",
    "application/apps/rustcore/wasm-bindings/test_output",
    # Client
    "application/client/dist",
    "application/client/node_modules",
    # Updater
    "application/apps/precompiled/updater/target",
    # App
    "application/holder/dist",
    "application/holder/node_modules",
    # Chipmunk CLI
    "cli/chipmunk-cli/target",
]


def run_clean_command():
    """Runs Clean Commands on all targets and insure that all build directories are deleted.
    Clean command will run in the UI mode "immediate"
    """
    print_blue_bold("Running clean command...")
    run_command(CLEAN_COMMAND)
    for path in get_removed_paths():
        if path.exists():
            raise AssertionError(f"Path exists after clean. Path: {path}")

    print_green_bold("*** Check for Clean Command Succeeded ***")


def get_removed_paths() -> list[Path]:
    """Provides the paths for the directories that must be removed after running the clean command"""
    root_dir = get_root()
    return [root_dir.joinpath(sub_dir) for sub_dir in PATHS_TO_CHECK]


if __name__ == "__main__":
    run_clean_command()
