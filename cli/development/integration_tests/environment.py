"""
Provides methods to test the Environment commands in Chipmunk Build CLI Tool
"""

from utls import run_command, print_blue_bold, print_green_bold

ENVIRONMENT_CHECK_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "environment",
    "check",
]

ENVIRONMENT_PRINT_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "environment",
    "print",
]


def run_environment_commands():
    """Runs environment command to check the installed development tools for chipmunk,
    and the command to print infos about those tools"""
    print_blue_bold("Running Environment Check command...")
    run_command(ENVIRONMENT_CHECK_COMMAND)
    print_green_bold("*** Environment Check Command Succeeded ***")

    print_blue_bold("Running Environment Print command...")
    run_command(ENVIRONMENT_PRINT_COMMAND)
    print_green_bold("*** Environment Print Command Succeeded ***")


if __name__ == "__main__":
    run_environment_commands()
