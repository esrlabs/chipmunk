"""
Provide method to run the tests for all the commands provided by Chipmunk Build CLI Tool
All the tests build and run the current build CLI implementation in release mode, therefore 
it must be invoked from withing `Chipmunk/cli/development-cli` directory
"""

from utls import print_red_bold, print_blue_bold, print_green_bold, print_cyan
from build import run_build_tests
from clean import run_clean_command
from environment import run_environment_commands
from lint import run_lint_command
from print_dot import run_print_dot_commands
from shell_compl import run_shell_completion_commands
from test_cmd import run_test_command
from release import run_release_command
from bench import run_benchmark_command
from user_config import run_user_configs_commands


def run_all():
    """Run the tests for all commands provided by Chipmunk Build CLI Tool"""
    print_blue_bold("Running tests for all commands of Chipmunk Build CLI Tool")

    ### Environment ###
    try:
        run_environment_commands()
    except Exception:
        print_err("Environment")
        raise
    print_separator()

    ### Lint ###
    try:
        run_lint_command()
    except Exception:
        print_err("Lint")
        raise
    print_separator()

    ### Clean ###
    try:
        run_clean_command()
    except Exception:
        print_err("Clean")
        raise
    print_separator()

    ### Build ###
    try:
        run_build_tests()
    except Exception:
        print_err("Build")
        raise
    print_separator()

    ### Test ###
    try:
        run_test_command()
    except Exception:
        print_err("Test")
        raise
    print_separator()

    ### Release ###
    try:
        run_release_command()
    except Exception:
        print_err("Release")
        raise
    print_separator()

    ### Benchmarks ###
    try:
        run_benchmark_command()
    except Exception:
        print_err("Benchmarks")
        raise
    print_separator()

    ### Print Dots ###
    try:
        run_print_dot_commands()
    except Exception:
        print_err("Print Dots")
        raise
    print_separator()

    ### User Configurations ###
    try:
        run_user_configs_commands()
    except Exception:
        print_err("User Configurations")
        raise
    print_separator()

    ### Shell Completion ###
    try:
        run_shell_completion_commands()
    except Exception:
        print_err("Shell Completion")
        raise

    print_green_bold(
        "******** Tests for all commands of Chipmunk Build CLI Tool succeeded ********"
    )


def print_err(cmd_name: str):
    """Prints a formatted error with the main command name"""
    print_red_bold(f"Error while running tests for {cmd_name} commands")


def print_separator():
    """Prints a colored separator between main commands"""
    print_cyan("------------------------------------------------------------------")


if __name__ == "__main__":
    run_all()
