"""
Provides methods to test the Lint command in Chipmunk Build CLI Tool
"""

import subprocess

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
    print("Running Lint command...")
    subprocess.run(LINT_COMMAND, check=True)
    print("*** Check for Lint Command Succeeded ***")


if __name__ == "__main__":
    run_lint_command()
