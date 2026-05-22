#!/usr/bin/env python3

import sys

if sys.version_info < (3, 7):
    sys.stderr.write("error: Python 3.7 or newer is required. Run this with python3.\n")
    raise SystemExit(1)

import argparse
import os
import platform
import plistlib
import shutil
import subprocess
import tarfile
import zipfile
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:
    tomllib = None


APP_NAME = "chipmunk.app"
BUNDLE_ID = "com.esrlabs.chipmunk"


def main():
    parser = argparse.ArgumentParser(
        description="Build and package the Chipmunk native app."
    )
    parser.add_argument(
        "--code-sign",
        action="store_true",
        help="Sign, notarize, and staple the macOS app bundle when signing env vars are present.",
    )
    args = parser.parse_args()

    clean_release()
    build_app()

    version = app_version()
    if is_macos():
        archive = package_macos(version, code_sign=args.code_sign)
    else:
        archive = package_portable(version)

    print("Chipmunk release artifact created: {}".format(archive))
    return 0


def build_app():
    run(
        [
            "cargo",
            "build",
            "--release",
            "--locked",
            "--manifest-path",
            "gui/application/Cargo.toml",
        ],
        cwd=app_workspace_root(),
        error="Building Chipmunk failed",
    )


def package_portable(version):
    archive_root = "chipmunk@{}-{}-portable".format(version, platform_name())
    staging_dir = app_release_path() / archive_root

    staging_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(app_binary_path(), staging_dir / app_binary_name())
    shutil.copy2(repo_readme_path(), staging_dir / "README.md")

    if is_windows():
        archive = app_release_path() / "{}.zip".format(archive_root)
        zip_directory_contents(staging_dir, archive)
    else:
        archive = app_release_path() / "{}.tgz".format(archive_root)
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(staging_dir, arcname=archive_root)

    return archive


def zip_directory_contents(source_dir, archive):
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                zip_file.write(path, path.relative_to(source_dir))


def package_macos(version, code_sign):
    app_root = app_release_path() / APP_NAME
    contents = app_root / "Contents"
    macos_dir = contents / "MacOS"
    resources_dir = contents / "Resources"

    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)

    executable = macos_dir / "chipmunk"
    shutil.copy2(app_binary_path(), executable)
    shutil.copy2(icon_path(), resources_dir / "icon.icns")
    shutil.copy2(repo_readme_path(), app_release_path() / "README.md")
    write_info_plist(contents / "Info.plist", version)
    executable.chmod(0o755)

    signing_enabled = code_sign and signing_allowed()
    if code_sign and not signing_enabled:
        print(
            "Skipping code signing because required environment variables are missing "
            "or SKIP_NOTARIZE is set.",
            file=sys.stderr,
        )

    if signing_enabled:
        sign_app(app_root)

    archive = app_release_path() / "chipmunk@{}-{}-portable.zip".format(
        version, platform_name()
    )
    zip_macos_bundle(app_root, archive)

    if signing_enabled:
        notarize_archive(archive)
        run(["xcrun", "stapler", "staple", str(app_root)], error="Stapling chipmunk app failed")
        run(
            ["xcrun", "stapler", "validate", str(app_root)],
            error="Validating stapled chipmunk app failed",
        )
        zip_macos_bundle(app_root, archive)

    return archive


def sign_app(app_root):
    signing_id = require_env("SIGNING_ID")
    executable = app_root / "Contents" / "MacOS" / "chipmunk"

    run(
        [
            "codesign",
            "--force",
            "--sign",
            signing_id,
            "--timestamp",
            "--options",
            "runtime",
            "--entitlements",
            str(entitlements_path()),
            str(executable),
        ],
        error="Signing chipmunk executable failed",
    )
    run(
        [
            "codesign",
            "--force",
            "--sign",
            signing_id,
            "--timestamp",
            "--options",
            "runtime",
            "--deep",
            "--strict",
            "--entitlements",
            str(entitlements_path()),
            str(app_root),
        ],
        error="Signing chipmunk app bundle failed",
    )
    run(
        ["codesign", "--verify", "--verbose=4", str(app_root)],
        error="Verifying chipmunk app bundle signature failed",
    )


def notarize_archive(archive):
    result = subprocess.run(
        [
            "xcrun",
            "notarytool",
            "submit",
            "--force",
            "--wait",
            "--verbose",
            str(archive),
            "--apple-id",
            require_env("APPLEID"),
            "--team-id",
            require_env("TEAMID"),
            "--password",
            require_env("APPLEIDPASS"),
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)

    if result.returncode != 0:
        raise RuntimeError("Chipmunk notarize command failed")
    if "status: Accepted" not in "{}\n{}".format(result.stdout, result.stderr):
        raise RuntimeError("Chipmunk notarize command did not report accepted status")


def zip_macos_bundle(app_root, archive):
    run(
        ["ditto", "-c", "-k", "--keepParent", str(app_root), str(archive)],
        error="Creating macOS chipmunk zip archive failed",
    )


def clean_release():
    release_path = app_release_path()
    if release_path.exists():
        shutil.rmtree(release_path)
    release_path.mkdir(parents=True)


def app_version():
    manifest = app_workspace_root() / "Cargo.toml"
    if tomllib is not None:
        with manifest.open("rb") as file:
            cargo_toml = tomllib.load(file)
        return cargo_toml["workspace"]["package"]["version"]

    return read_workspace_package_version(manifest)


def read_workspace_package_version(manifest):
    current_section = ""
    for raw_line in manifest.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current_section = line[1:-1]
            continue
        if current_section == "workspace.package" and line.startswith("version"):
            _, value = line.split("=", 1)
            return value.strip().strip('"')
    raise RuntimeError("Could not find workspace.package.version in {}".format(manifest))


def write_info_plist(path, version):
    plist = {
        "CFBundleDevelopmentRegion": "en",
        "CFBundleDisplayName": "Chipmunk",
        "CFBundleExecutable": "chipmunk",
        "CFBundleIconFile": "icon.icns",
        "CFBundleIdentifier": BUNDLE_ID,
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": "Chipmunk",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": version,
        "CFBundleVersion": version,
    }
    with path.open("wb") as file:
        plistlib.dump(plist, file, sort_keys=False)


def signing_allowed():
    required = ["APPLEID", "APPLEIDPASS", "TEAMID", "SIGNING_ID"]
    return all(os.environ.get(name) for name in required) and "SKIP_NOTARIZE" not in os.environ


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError("Missing env var {}".format(name))
    return value


def run(command, error, cwd=None):
    result = subprocess.run(command, cwd=cwd)
    if result.returncode != 0:
        raise RuntimeError(error)


def repo_root():
    return Path(__file__).resolve().parent.parent


def app_root():
    return repo_root() / "application" / "apps" / "indexer" / "gui" / "application"


def app_release_path():
    return app_root() / "release"


def app_workspace_root():
    return repo_root() / "application" / "apps" / "indexer"


def app_binary_path():
    path = app_workspace_root() / "target" / "release" / app_binary_name()
    if not path.exists():
        raise RuntimeError("Chipmunk binary doesn't exist: {}".format(path))
    return path


def app_binary_name():
    return "chipmunk.exe" if is_windows() else "chipmunk"


def repo_readme_path():
    return repo_root() / "README.md"


def icon_path():
    return repo_root() / "application" / "holder" / "resources" / "mac" / "chipmunk.icns"


def entitlements_path():
    return (
        repo_root()
        / "application"
        / "holder"
        / "resources"
        / "mac"
        / "entitlements.mac.plist"
    )


def platform_name():
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "linux":
        name = "linux"
    elif system == "darwin":
        name = "darwin"
    elif system == "windows":
        name = "win64"
    else:
        raise RuntimeError("Unknown target os: {}, arch: {}".format(system, machine))

    if machine in {"arm64", "aarch64"}:
        name += "-arm64"

    return name


def is_macos():
    return platform.system() == "Darwin"


def is_windows():
    return platform.system() == "Windows"


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        sys.stderr.write("error: {}\n".format(error))
        raise SystemExit(1)
