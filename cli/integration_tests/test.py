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
    print("Running test command...")
    subprocess.run(TEST_COMMAND, check=True)
    print("*** Check for Test Command Succeeded ***")


if __name__ == "__main__":
    run_test_command()
