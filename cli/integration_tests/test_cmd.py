"""
Provides methods to test the Test Command in Chipmunk Build CLI Tool.
The command will have the UI option "report".
"""

from utls import run_command, print_blue_bold, print_green_bold

TEST_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "test",
    # Add UI option bar explicitly.
    "-u",
    "report",
]


def run_test_command():
    """Runs test command on all targets. This test will fail on test errors of chipmunk targets as well.
    The command will have the UI option "report".
    """
    print_blue_bold("Running test command with UI option 'report'...")
    run_command(TEST_COMMAND)
    print_green_bold("*** Check for Test Command Succeeded ***")


if __name__ == "__main__":
    run_test_command()
