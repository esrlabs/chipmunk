#!/usr/bin/env python3
"""Build and package the Chipmunk app and CLI.

This script is the release artifact's source of truth for CI and local builds.
It deliberately keeps the public portable artifact names compatible with the
legacy Electron release line while adding installers for easy installation.
Platform-specific signing is optional so local smoke tests can still
exercise packaging without access to CI secrets.
"""

import sys

if sys.version_info < (3, 7):
    sys.stderr.write("error: Python 3.7 or newer is required. Run this with python3.\n")
    raise SystemExit(1)

import argparse
import base64
import gzip
import os
import platform
import plistlib
import shutil
import subprocess
import tarfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from development.packaging.linux import LinuxPackageConfig, package_linux_installers

try:
    import tomllib
except ModuleNotFoundError:
    tomllib = None


APP_NAME = "chipmunk.app"
BUNDLE_ID = "com.esrlabs.chipmunk"
# Windows Installer upgrades require this UUID(via uuidgen) to remain stable across
# versions; changing it would make Windows treat Chipmunk as a different app.
WINDOWS_UPGRADE_CODE = "37525481-AF0C-479F-975A-2D61D8C7D6C4"
DEFAULT_WINDOWS_TIMESTAMP_URL = "http://timestamp.digicert.com"


def main():
    parser = argparse.ArgumentParser(
        description="Build and package the Chipmunk native app and CLI."
    )
    parser.add_argument(
        "--code-sign",
        action="store_true",
        help="Sign, notarize, and staple the macOS app bundle when signing env vars are present.",
    )
    args = parser.parse_args()

    clean_release()
    build_app()
    build_cli()

    version = app_version()
    cli_version_value = cli_version()
    if is_macos():
        artifacts = package_macos(version, code_sign=args.code_sign)
    elif is_windows():
        artifacts = [package_portable(version), package_windows_msi(version)]
    else:
        artifacts = [package_portable(version)]
        artifacts.extend(package_linux_installers(linux_package_config(version)))

    artifacts.append(package_cli_portable(cli_version_value, code_sign=args.code_sign))

    for artifact in artifacts:
        print("Chipmunk release artifact created: {}".format(artifact))
    return 0


def build_app():
    """Build only the native desktop app binary from the workspace."""
    run(
        [
            "cargo",
            "build",
            "--release",
            "--locked",
            "--manifest-path",
            str(app_manifest_path()),
        ],
        cwd=workspace_root(),
        error="Building Chipmunk failed",
    )


def build_cli():
    """Build the standalone CLI binary that ships as its own release artifact."""
    run(
        [
            "cargo",
            "build",
            "--release",
            "--locked",
            "--manifest-path",
            str(cli_manifest_path()),
        ],
        cwd=workspace_root(),
        error="Building Chipmunk CLI failed",
    )


def package_portable(version):
    """Create the Linux/Windows portable archive.

    These archives keep the old public naming scheme but intentionally use a
    flat internal layout. The v3 updater extracts Linux and Windows archives
    directly into the current install directory, so a top-level wrapper folder
    would leave the new binary in the wrong place.
    """
    archive_root = "chipmunk@{}-{}-portable".format(version, platform_name())
    staging_dir = app_release_path() / archive_root

    reset_staging_dir(staging_dir)
    shutil.copy2(app_binary_path(), staging_dir / app_binary_name())

    archive = app_release_path() / "{}.tgz".format(archive_root)
    write_flat_tgz_archive(staging_dir, archive)

    return archive


def package_cli_portable(version, code_sign=False):
    """Create the portable CLI archive using the legacy flat layout."""
    archive_root = "chipmunk-cli@{}-{}-portable".format(version, platform_name())
    staging_dir = app_release_path() / archive_root

    reset_staging_dir(staging_dir)
    cli = staging_dir / cli_binary_name()
    shutil.copy2(cli_binary_path(), cli)

    if is_macos():
        sign_and_notarize_macos_cli(cli, code_sign=code_sign)

    archive = app_release_path() / "{}.tgz".format(archive_root)
    write_flat_tgz_archive(staging_dir, archive)

    return archive


def reset_staging_dir(staging_dir):
    """Create a fresh staging directory so stale files never enter an archive."""
    if staging_dir.exists():
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True)


def write_flat_tgz_archive(source_dir, archive):
    """Tar the staged files at archive root, without a wrapper directory."""
    with archive.open("wb") as file:
        with gzip.GzipFile(
            filename=tgz_inner_tar_name(archive),
            mode="wb",
            fileobj=file,
        ) as gzip_file:
            with tarfile.open(fileobj=gzip_file, mode="w") as tar:
                for path in sorted(source_dir.iterdir(), key=lambda path: path.name):
                    tar.add(path, arcname=path.name)


def write_tgz_archive(source_path, archive, arcname):
    """Tar one path under an explicit archive name."""
    with archive.open("wb") as file:
        with gzip.GzipFile(
            filename=tgz_inner_tar_name(archive),
            mode="wb",
            fileobj=file,
        ) as gzip_file:
            with tarfile.open(fileobj=gzip_file, mode="w") as tar:
                tar.add(source_path, arcname=arcname)


def tgz_inner_tar_name(archive):
    """Return the tar payload name exposed by tools that unpack gzip first."""
    name = archive.name
    if name.endswith(".tgz"):
        return "{}.tar".format(name[:-4])
    if name.endswith(".tar.gz"):
        return name[:-3]
    return "{}.tar".format(name)


def package_macos(version, code_sign):
    """Create the macOS app bundle, portable archive, and installer package."""
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

    if signing_enabled:
        # Apple's notary service needs a zip-compatible macOS app bundle. Keep
        # that zip as a temporary input only; the public portable artifact stays
        # a .tgz to preserve the release naming convention.
        notarization_dir = app_release_path() / "notarization"
        notarization_archive = notarization_dir / "chipmunk-notarization.zip"
        notarization_dir.mkdir(parents=True, exist_ok=True)
        try:
            zip_macos_bundle(app_root, notarization_archive)
            notarize_archive(notarization_archive)
        finally:
            shutil.rmtree(notarization_dir, ignore_errors=True)

        run(["xcrun", "stapler", "staple", str(app_root)], error="Stapling chipmunk app failed")
        run(
            ["xcrun", "stapler", "validate", str(app_root)],
            error="Validating stapled chipmunk app failed",
        )

    archive = app_release_path() / "chipmunk@{}-{}-portable.tgz".format(
        version, platform_name()
    )
    write_tgz_archive(app_root, archive, APP_NAME)

    pkg = package_macos_pkg(app_root, version, code_sign=signing_enabled)

    return [archive, pkg]


def package_macos_pkg(app_root, version, code_sign):
    """Build the macOS installer package around the already-prepared app."""
    pkg = app_release_path() / "chipmunk@{}-{}.pkg".format(
        version, platform_name()
    )
    # The .pkg should launch Chipmunk after installation. pkgbuild wires in the
    # postinstall script from this generated scripts directory.
    scripts_dir = app_release_path() / "pkg-scripts"
    write_macos_pkg_scripts(scripts_dir)

    cmd = [
        "pkgbuild",
        "--component",
        str(app_root),
        "--install-location",
        "/Applications",
        "--identifier",
        BUNDLE_ID,
        "--version",
        installer_version(version),
        "--scripts",
        str(scripts_dir),
    ]

    installer_signing_enabled = code_sign and installer_signing_allowed()

    if installer_signing_enabled:
        cmd.extend(["--sign", require_env("INSTALLER_SIGNING_ID")])
    elif code_sign:
        warn_unsigned_macos_pkg()

    cmd.append(str(pkg))
    run(cmd, error="Creating macOS chipmunk pkg failed")

    if installer_signing_enabled:
        notarize_archive(pkg)
        run(["xcrun", "stapler", "staple", str(pkg)], error="Stapling chipmunk pkg failed")
        run(
            ["xcrun", "stapler", "validate", str(pkg)],
            error="Validating stapled chipmunk pkg failed",
        )

    return pkg


def write_macos_pkg_scripts(scripts_dir):
    """Copy checked-in installer scripts into pkgbuild's scripts directory."""
    scripts_dir.mkdir(parents=True, exist_ok=True)
    postinstall = scripts_dir / "postinstall"
    shutil.copy2(macos_pkg_postinstall_path(), postinstall)
    postinstall.chmod(0o755)


def package_windows_msi(version):
    """Create the Windows MSI installer from the generated WiX definition."""
    wix_dir = app_release_path() / "wix"
    wix_dir.mkdir(parents=True, exist_ok=True)

    wxs = wix_dir / "chipmunk.wxs"
    license_rtf = wix_dir / "license.rtf"
    msi = app_release_path() / "chipmunk@{}-{}.msi".format(version, platform_name())
    wixobj = wix_dir / "chipmunk.wixobj"

    write_windows_license_rtf(license_rtf)
    write_windows_wxs(wxs, version)

    candle = find_windows_tool("candle.exe")
    light = find_windows_tool("light.exe")

    run(
        [str(candle), "-nologo", "-out", str(wixobj), str(wxs)],
        error="Compiling Windows MSI definition failed",
    )
    run(
        [
            str(light),
            "-nologo",
            "-ext",
            "WixUIExtension",
            "-ext",
            "WixUtilExtension",
            "-out",
            str(msi),
            str(wixobj),
        ],
        error="Linking Windows MSI failed",
    )

    sign_windows_file(msi)

    return msi


def write_windows_wxs(path, version):
    """Write the WiX source used to build the Windows MSI.

    The MSI installs into Program Files, adds a Start Menu shortcut, and offers
    a launch checkbox on the final installer screen.
    """
    exe = app_binary_path()
    readme = repo_readme_path()
    icon = windows_icon_path()
    license_rtf = path.parent / "license.rtf"

    template = windows_wxs_template_path().read_text(encoding="utf-8")
    path.write_text(
        template.format(
            installer_version=installer_version(version),
            upgrade_code=WINDOWS_UPGRADE_CODE,
            icon=xml_attr(icon),
            license=xml_attr(license_rtf),
            exe=xml_attr(exe),
            readme=xml_attr(readme),
        ),
        encoding="utf-8",
    )


def write_windows_license_rtf(path):
    """Copy the license text shown by the Windows installer UI."""
    shutil.copy2(windows_license_rtf_path(), path)


def sign_macos_executable(path, error, entitlements=None):
    """Sign a single macOS executable with the Developer ID Application identity."""
    signing_id = require_env("SIGNING_ID")
    cmd = [
        "codesign",
        "--force",
        "--sign",
        signing_id,
        "--timestamp",
        "--options",
        "runtime",
    ]
    if entitlements is not None:
        cmd.extend(["--entitlements", str(entitlements)])
    cmd.append(str(path))
    run(cmd, error=error)


def sign_app(app_root):
    """Sign the app bundle with the Developer ID Application identity."""
    signing_id = require_env("SIGNING_ID")
    executable = app_root / "Contents" / "MacOS" / "chipmunk"

    sign_macos_executable(
        executable,
        error="Signing chipmunk executable failed",
        entitlements=entitlements_path(),
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


def sign_and_notarize_macos_cli(executable, code_sign):
    """Sign and notarize the staged macOS CLI binary before archiving it."""
    if not code_sign:
        return
    if not signing_allowed():
        print(
            "Skipping macOS CLI code signing because required environment "
            "variables are missing or SKIP_NOTARIZE is set.",
            file=sys.stderr,
        )
        return

    sign_macos_executable(executable, error="Signing chipmunk CLI failed")
    run(
        ["codesign", "--verify", "--verbose=4", str(executable)],
        error="Verifying chipmunk CLI signature failed",
    )

    notarization_dir = app_release_path() / "cli-notarization"
    notarization_archive = notarization_dir / "chipmunk-cli-notarization.zip"
    notarization_dir.mkdir(parents=True, exist_ok=True)
    try:
        zip_macos_path(executable, notarization_archive)
        notarize_archive(notarization_archive)
    finally:
        shutil.rmtree(notarization_dir, ignore_errors=True)


def notarize_archive(archive):
    """Submit a signed macOS archive to Apple and wait for acceptance."""
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
    """Create the zip format Apple expects for app bundle notarization."""
    zip_macos_path(app_root, archive)


def zip_macos_path(source_path, archive):
    """Create the zip format Apple expects for notarization uploads."""
    run(
        ["ditto", "-c", "-k", "--keepParent", str(source_path), str(archive)],
        error="Creating macOS chipmunk zip archive failed",
    )


def clean_release():
    """Start every packaging run from an empty target/dist directory."""
    release_path = app_release_path()
    if release_path.exists():
        shutil.rmtree(release_path)
    release_path.mkdir(parents=True)


def app_version():
    """Read the release version from workspace.package.version."""
    manifest = workspace_root() / "Cargo.toml"
    if tomllib is not None:
        with manifest.open("rb") as file:
            cargo_toml = tomllib.load(file)
        return cargo_toml["workspace"]["package"]["version"]

    return read_workspace_package_version(manifest)


def cli_version():
    """Read the CLI artifact version from crates/cli/Cargo.toml."""
    manifest = cli_manifest_path()
    if tomllib is not None:
        with manifest.open("rb") as file:
            cargo_toml = tomllib.load(file)
        return cargo_toml["package"]["version"]

    return read_package_version(manifest)


def read_workspace_package_version(manifest):
    """Fallback TOML reader for Python versions without tomllib."""
    return read_package_version(manifest, section="workspace.package")


def read_package_version(manifest, section="package"):
    """Fallback TOML version reader for simple package tables."""
    current_section = ""
    for raw_line in manifest.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current_section = line[1:-1]
            continue
        if current_section == section and line.startswith("version"):
            _, value = line.split("=", 1)
            return value.strip().strip('"')
    raise RuntimeError("Could not find {}.version in {}".format(section, manifest))


def write_info_plist(path, version):
    """Create the minimal macOS Info.plist for the app bundle."""
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
    """Return whether macOS app signing and notarization should run."""
    required = ["APPLEID", "APPLEIDPASS", "TEAMID", "SIGNING_ID"]
    return all(os.environ.get(name) for name in required) and "SKIP_NOTARIZE" not in os.environ


def installer_signing_allowed():
    """Return whether the imported identity can sign macOS installer packages."""
    required = ["APPLEID", "APPLEIDPASS", "TEAMID", "INSTALLER_SIGNING_ID"]
    if not all(os.environ.get(name) for name in required) or "SKIP_NOTARIZE" in os.environ:
        return False

    if "Developer ID Installer" not in os.environ["INSTALLER_SIGNING_ID"]:
        return False

    return True


def warn_unsigned_macos_pkg():
    print(
        "Creating unsigned macOS PKG. PKG signing requires a Developer ID Installer "
        "certificate imported into the CI keychain; the Developer ID Application "
        "identity used by SIGNING_ID cannot sign installer packages.",
        file=sys.stderr,
    )


def windows_signing_allowed():
    """Return whether the optional Windows signing certificate is available."""
    required = ["WINDOWS_SIGNING_CERT_PFX", "WINDOWS_SIGNING_CERT_PASSWORD"]
    return all(os.environ.get(name) for name in required)


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError("Missing env var {}".format(name))
    return value


def run(command, error, cwd=None):
    """Run a subprocess and raise the caller's domain-specific error on failure."""
    result = subprocess.run(command, cwd=cwd)
    if result.returncode != 0:
        raise RuntimeError(error)


def installer_version(version):
    """Convert semver into the three-part version accepted by installers."""
    core = version.split("+", 1)[0].split("-", 1)[0]
    parts = core.split(".")
    if len(parts) < 3 or not all(part.isdigit() for part in parts[:3]):
        raise RuntimeError("Version cannot be used for installer metadata: {}".format(version))

    return ".".join(parts[:3])


def xml_attr(value):
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def find_windows_tool(name):
    """Locate WiX or Windows SDK tooling on PATH or common install roots."""
    found = shutil.which(name)
    if found is not None:
        return Path(found)

    roots = []
    for env_name in ["WIX", "ProgramFiles(x86)", "ProgramFiles"]:
        value = os.environ.get(env_name)
        if value:
            roots.append(Path(value))

    for root in roots:
        if not root.exists():
            continue
        matches = sorted(root.rglob(name), reverse=True)
        if matches:
            return matches[0]

    raise RuntimeError(
        "Required Windows packaging tool '{}' was not found on PATH.".format(name)
    )


def sign_windows_file(path):
    """Sign a Windows artifact when a PFX certificate is available."""
    if not windows_signing_allowed():
        print(
            "Skipping Windows code signing because WINDOWS_SIGNING_CERT_PFX or "
            "WINDOWS_SIGNING_CERT_PASSWORD is missing.",
            file=sys.stderr,
        )
        return

    signtool = find_windows_tool("signtool.exe")
    cert = app_release_path() / "windows-signing.pfx"
    cert.write_bytes(base64.b64decode(require_env("WINDOWS_SIGNING_CERT_PFX")))

    timestamp_url = os.environ.get("WINDOWS_SIGNING_TIMESTAMP_URL", DEFAULT_WINDOWS_TIMESTAMP_URL)
    try:
        run(
            [
                str(signtool),
                "sign",
                "/fd",
                "SHA256",
                "/tr",
                timestamp_url,
                "/td",
                "SHA256",
                "/f",
                str(cert),
                "/p",
                require_env("WINDOWS_SIGNING_CERT_PASSWORD"),
                str(path),
            ],
            error="Signing Windows artifact failed",
        )
    finally:
        try:
            cert.unlink()
        except FileNotFoundError:
            pass


def repo_root():
    return REPO_ROOT


def app_root():
    return repo_root() / "crates" / "app"


def cli_root():
    return repo_root() / "crates" / "cli"


def app_manifest_path():
    return app_root() / "Cargo.toml"


def cli_manifest_path():
    return cli_root() / "Cargo.toml"


def app_release_path():
    return repo_root() / "target" / "dist"


def workspace_root():
    return repo_root()


def app_binary_path():
    path = workspace_root() / "target" / "release" / app_binary_name()
    if not path.exists():
        raise RuntimeError("Chipmunk binary doesn't exist: {}".format(path))
    return path


def app_binary_name():
    return "chipmunk.exe" if is_windows() else "chipmunk"


def cli_binary_path():
    path = workspace_root() / "target" / "release" / cli_binary_name()
    if not path.exists():
        raise RuntimeError("Chipmunk CLI binary doesn't exist: {}".format(path))
    return path


def cli_binary_name():
    return "chipmunk-cli.exe" if is_windows() else "chipmunk-cli"


def repo_readme_path():
    return repo_root() / "README.md"


def icon_path():
    return app_root() / "data" / "mac" / "chipmunk.icns"


def windows_icon_path():
    return app_root() / "data" / "win" / "chipmunk.ico"


def windows_wxs_template_path():
    return app_root() / "data" / "win" / "chipmunk.wxs.in"


def windows_license_rtf_path():
    return app_root() / "data" / "win" / "license.rtf"


def entitlements_path():
    return app_root() / "data" / "mac" / "entitlements.mac.plist"


def macos_pkg_postinstall_path():
    return app_root() / "data" / "mac" / "pkg-scripts" / "postinstall"


def linux_package_config(version):
    return LinuxPackageConfig(
        version=version,
        dist_dir=app_release_path(),
        app_binary=app_binary_path(),
        desktop_file=app_root() / "data" / "linux" / "chipmunk.desktop",
        icon_dir=app_root() / "data" / "icons" / "png",
        readme=repo_readme_path(),
        license_file=repo_root() / "LICENSE.txt",
    )


def platform_name():
    """Return the platform token used in public release artifact names."""
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
