"""
Provides methods to test the Release command in Chipmunk Build CLI Tool.
"""

from utls import get_root, run_command, print_green_bold, print_blue_bold


RELEASE_COMMAND = [
    "cargo",
    "run",
    "-r",
    "--",
    "chipmunk",
    "release",
]


def run_release_command():
    """Runs release command for Chipmunk. This command will fail if building Chipmunk in release mode fails too."""

    print_blue_bold("Running Release Command...")

    run_command(RELEASE_COMMAND)

    print("Checking if release directory is not empty...")

    release_dir = get_root().joinpath("application/holder/release")

    if not release_dir.exists() or not release_dir.is_dir():
        raise AssertionError(
            f"Release Path doesn't exist after release. Path: {release_dir}"
        )

    if not any(release_dir.iterdir()):
        raise AssertionError(
            f"Release Path exists after release but it's empty. Path: {release_dir}"
        )

    print("Checking release directory Succeeded")

    print_green_bold("*** Check for Release Command Succeeded ***")


if __name__ == "__main__":
    run_release_command()
