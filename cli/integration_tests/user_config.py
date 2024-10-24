"""
Provides methods to test the User Configurations commands in Chipmunk Build CLI Tool
"""

from utls import run_command, print_blue_bold, print_green_bold

CONFIG_BASE_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "config",
]


def run_user_configs_commands():
    """Runs commands to print the default configurations and the path for the configurations file"""
    print_blue_bold("Running print configurations file path Command...")
    print_path_cmd = CONFIG_BASE_COMMAND.copy()
    print_path_cmd.append("path")
    run_command(print_path_cmd)
    print_green_bold("*** Print configurations file path Command Succeeded ***")

    print_blue_bold("Running print default configurations Command...")
    print_default_cmd = CONFIG_BASE_COMMAND.copy()
    print_default_cmd.append("default")
    run_command(print_default_cmd)
    print_green_bold("*** Print default configurations Command Succeeded ***")


if __name__ == "__main__":
    run_user_configs_commands()
