"""
Provides methods to test the Shell Completion command for variety of shells in Chipmunk Build CLI Tool
"""

from utls import run_command, print_blue_bold, print_green_bold

PRINT_COMPLETION_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "shell-completion",
]

# These are all the supported shells for completion
SHELLS = ["bash", "elvish", "fish", "powershell", "zsh"]


def run_shell_completion_commands():
    """Runs commands to generate shell completion on all the available shells"""
    for shell in SHELLS:
        print_blue_bold(f"Running Shell Completion command for {shell}")
        shell_command = PRINT_COMPLETION_COMMAND.copy()
        shell_command.append(shell)
        run_command(shell_command)
        print_green_bold(f"*** Shell Completion Command for {shell} Succeeded ***")


if __name__ == "__main__":
    run_shell_completion_commands()
