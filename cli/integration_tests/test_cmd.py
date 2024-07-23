"""
Provides methods to test the Test Command in Chipmunk Build CLI Tool
"""

from utls import run_command, print_blue_bold, print_green_bold

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
    print_blue_bold("Running test command...")
    run_command(TEST_COMMAND)
    print_green_bold("*** Check for Test Command Succeeded ***")


if __name__ == "__main__":
    run_test_command()
