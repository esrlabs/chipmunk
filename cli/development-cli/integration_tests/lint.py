"""
Provides methods to test the Lint command in Chipmunk Build CLI Tool.
It tests the fail-fast option and the "report" option on the UI
"""

from utls import run_command, print_green_bold, print_blue_bold

LINT_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "lint",
    # Set fail fast
    "-f",
    # Set the UI mode to report.
    "-u",
    "report",
]


def run_lint_command():
    """Runs lint command for all targets. This test will fail on linting errors as well.
    Fail fast option is activated for the lint command here.
    UI option set to "report"
    """

    print_blue_bold(
        "Running Lint command with fail fast, showing log reprots once done..."
    )
    run_command(LINT_COMMAND)
    print_green_bold("*** Check for Lint Command Succeeded ***")


if __name__ == "__main__":
    run_lint_command()
