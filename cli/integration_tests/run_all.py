"""
Provide method to run the tests for all the commands provided by Chipmunk Build CLI Tool
"""

from utls import print_red_bold, print_blue_bold, print_green_bold, print_cyan
from build import run_build_tests
from clean import run_clean_command
from environment import run_environment_commands
from lint import run_lint_command
from print_dot import run_print_dot_commands
from shell_compl import run_shell_completion_commands
from test_cmd import run_test_command


def print_err(cmd_name: str):
    print_red_bold(f"Error while running tests for {cmd_name} commands")


def print_separtor():
    print_cyan("------------------------------------------------------------------")


def run_all():
    """Run the tests for all commands provided by Chipmunk Build CLI Tool"""
    print_blue_bold("Running tests for all commands of Chipmunk Build CLI Tool")

    ### Environment ###
    try:
        run_environment_commands()
    except Exception:
        print_err("Environment")
        raise
    print_separtor()

    ### Lint ###
    try:
        run_lint_command()
    except Exception:
        print_err("Lint")
        raise
    print_separtor()

    ### Clean ###
    try:
        run_clean_command()
    except Exception:
        print_err("Clean")
        raise
    print_separtor()

    ### Build ###
    try:
        run_build_tests()
    except Exception:
        print_err("Build")
        raise
    print_separtor()

    ### Test ###
    try:
        run_test_command()
    except Exception:
        print_err("Test")
        raise
    print_separtor()

    ### Print Dots ###
    try:
        run_print_dot_commands()
    except Exception:
        print_err("Print Dots")
        raise
    print_separtor()

    ### Shell Completion ###
    try:
        run_shell_completion_commands()
    except Exception:
        print_err("Shell Completion")
        raise

    print_green_bold(
        "******** Tests for all commands of Chipmunk Build CLI Tool succeeded ********"
    )


if __name__ == "__main__":
    run_all()
