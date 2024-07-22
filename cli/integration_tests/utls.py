from pathlib import Path


def get_root() -> Path:
    """Get and validate the root directory of chipmunk repository

    Raises:
        IOError: If validation of root directory fails

    Returns:
        Root directory of chipmunk
    """

    # We are using the utls file with the assumption that is path is `root/cli/integration_tests`
    root_dir = Path(__file__).parent.parent.parent

    # Root Dir checks. This checks depends on the current chipmunk directories' structure
    sub_dirs = (
        root_dir.joinpath(dir_name)
        for dir_name in ["application", "developing", "cli", "scripts"]
    )

    if any(not path.exists() for path in sub_dirs):
        raise SystemError(f"Root directory verification fail. Root Dir: {root_dir}")

    return root_dir
