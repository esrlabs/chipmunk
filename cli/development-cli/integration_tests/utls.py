"""
Utilities function to be used among the modules to test Chipmunk Build CLI Tool
"""

from pathlib import Path
import subprocess


def get_root() -> Path:
    """Get and validate the root directory of chipmunk repository

    Raises:
        SystemError: If validation of root directory fails

    Returns:
        Root directory of chipmunk
    """

    # We are using the utls file with the assumption that is path is `root/cli/development-cli/integration_tests`
    root_dir = Path(__file__).parent.parent.parent.parent

    # Root Dir checks. This checks depends on the current chipmunk directories' structure
    sub_dirs = (
        root_dir.joinpath(dir_name)
        for dir_name in ["application", "developing", "cli", "scripts"]
    )

    if any(not path.exists() for path in sub_dirs):
        raise SystemError(f"Root directory verification fail. Root Dir: {root_dir}")

    return root_dir


def run_command(command_args: list[str]):
    """Runs the commands and its arguments after printing it to stdout

    Args:
        command_args: The command and its arguments in one string list
    """
    command_txt = " ".join(command_args)
    print_bold(f"Command: {command_txt}")
    subprocess.run(command_args, check=True)


class bcolors:
    """Color codes representation in ANSI"""

    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"


def print_bold(text: str):
    """Prints the given text to stdout with bold attribute"""
    print(f"{bcolors.BOLD}{text}{bcolors.ENDC}")


def print_blue_bold(text: str):
    """Prints the given text to stdout with bold and blue attribute"""
    print(f"{bcolors.BOLD}{bcolors.OKBLUE}{text}{bcolors.ENDC}{bcolors.ENDC}")


def print_green_bold(text: str):
    """Prints the given text to stdout with bold and green attribute"""
    print(f"{bcolors.BOLD}{bcolors.OKGREEN}{text}{bcolors.ENDC}{bcolors.ENDC}")


def print_red_bold(text: str):
    """Prints the given text to stdout with bold and red attribute"""
    print(f"{bcolors.BOLD}{bcolors.FAIL}{text}{bcolors.ENDC}{bcolors.ENDC}")


def print_cyan(text: str):
    """Prints the given text to stdout with cyan color attribute"""
    print(f"{bcolors.OKCYAN}{text}{bcolors.ENDC}")
