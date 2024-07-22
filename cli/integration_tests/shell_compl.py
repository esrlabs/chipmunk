"""
Provides methods to test the Shell Completion command for varity of shells in Chipmunk Build CLI Tool
"""

import subprocess

PRINT_COMPLETION_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "shell-completion",
]

SHELLS = ["bash", "elvish", "fish", "powershell", "zsh"]


def run_print_dot_commands():
    """Runs commands to generate shell completion on all the available shells"""
    for shell in SHELLS:
        print(f"Runnig Shell Completion command for {shell}")
        shell_command = PRINT_COMPLETION_COMMAND.copy()
        shell_command.append(shell)
        subprocess.run(shell_command, check=True)
        print(f"*** Shell Completion Command for {shell} Succeeded ***")


if __name__ == "__main__":
    run_print_dot_commands()
