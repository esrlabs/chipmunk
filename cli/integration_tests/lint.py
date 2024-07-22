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
    print("Running Lint command...")
    subprocess.run(LINT_COMMAND, check=True)
    print("*** Check for Lint Command Succeeded ***")


if __name__ == "__main__":
    run_lint_command()
