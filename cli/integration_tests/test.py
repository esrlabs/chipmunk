"""
Provides methods to test the Test Command in Chipmunk Build CLI Tool
"""

import subprocess

TEST_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "test",
]


def run_test_command():
    """Runs test command on all targets. This test will fail on test errors of chipmunk targets as well."""
    print("Running test command...")
    subprocess.run(TEST_COMMAND, check=True)
    print("*** Check for Test Command Succeeded ***")


if __name__ == "__main__":
    run_test_command()
