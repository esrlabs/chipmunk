"""
Provides methods to test the Lint command in Chipmunk Build CLI Tool
"""

from utls import run_command, print_green_bold, print_blue_bold

LINT_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "lint",
]


def run_lint_command():
    """Runs lint command for all targets. This test will fail on linting errors as well."""
    print_blue_bold("Running Lint command...")
    run_command(LINT_COMMAND)
    print_green_bold("*** Check for Lint Command Succeeded ***")


if __name__ == "__main__":
    run_lint_command()
