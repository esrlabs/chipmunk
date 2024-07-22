import subprocess

ENVIRONMENT_CHECK_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "environment",
    "check",
]

ENVIRONMENT_PRINT_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "environment",
    "print",
]


def run_environment_commands():
    """Runs environment command to check the installed development tools for chipmunk,
    and the command to print infos about those tools"""
    print("Running Environment Check command...")
    subprocess.run(ENVIRONMENT_CHECK_COMMAND, check=True)
    print("*** Environment Check Command Succeeded ***")

    print("Running Environment Print command...")
    subprocess.run(ENVIRONMENT_PRINT_COMMAND, check=True)
    print("*** Environment Print Command Succeeded ***")


if __name__ == "__main__":
    run_environment_commands()
