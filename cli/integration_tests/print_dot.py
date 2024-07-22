import subprocess

PRINT_DOT_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "print-dot",
]

PRINT_DOT_ALL_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "print-dot",
    "-a",
]


def run_print_dot_commands():
    """Runs print dot commands for both targets and tasks"""
    print("Running General Print Dot command...")
    subprocess.run(PRINT_DOT_COMMAND, check=True)
    print("*** General Print Dot command Succeeded ***")

    print("Running All Print Dot command...")
    subprocess.run(PRINT_DOT_ALL_COMMAND, check=True)
    print("*** All Print Dot command Succeeded ***")


if __name__ == "__main__":
    run_print_dot_commands()
