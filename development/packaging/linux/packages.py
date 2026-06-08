"""Build Linux DEB and RPM installers for the native Chipmunk app."""

import platform
import re
import shutil
import subprocess
import tarfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


PACKAGE_NAME = "chipmunk"
DEB_REVISION = "1"
RPM_STABLE_RELEASE = "1"
RPM_PRERELEASE_PREFIX = "0"
DEB_STATIC_DEPENDS = ("hicolor-icon-theme",)
ICON_SIZES = ("16", "24", "32", "64", "128", "256", "512")
SEMVER_RE = re.compile(
    r"^(?P<core>\d+\.\d+\.\d+)"
    r"(?:-(?P<prerelease>[0-9A-Za-z][0-9A-Za-z.-]*))?"
    r"(?:\+(?P<build>[0-9A-Za-z][0-9A-Za-z.-]*))?$"
)


@dataclass(frozen=True)
class LinuxPackageConfig:
    version: str
    dist_dir: Path
    app_binary: Path
    desktop_file: Path
    icon_dir: Path
    readme: Path
    license_file: Path


def package_linux_installers(config: LinuxPackageConfig) -> List[Path]:
    """Create Linux installer packages and return their artifact paths."""
    ensure_linux_host()

    work_dir = config.dist_dir / "linux-packaging"
    reset_dir(work_dir)

    return [
        build_deb(config, work_dir / "deb"),
        build_rpm(config, work_dir / "rpm"),
    ]


def build_deb(config: LinuxPackageConfig, work_dir: Path) -> Path:
    ensure_tools(["desktop-file-validate", "dpkg", "dpkg-deb", "dpkg-shlibdeps"])

    root = work_dir / "debian" / PACKAGE_NAME
    stage_install_tree(config, root, package_format="deb")
    validate_desktop_file(root)

    control_dir = root / "DEBIAN"
    make_dir(control_dir, 0o755)

    arch = deb_architecture()
    depends = deb_control_depends(
        deb_dependencies(root / "usr" / "bin" / PACKAGE_NAME, work_dir)
    )
    control = render_template(
        "debian/control.in",
        {
            "architecture": arch,
            "depends_field": "Depends: {}\n".format(depends) if depends else "",
            "installed_size": str(installed_size_kib(root)),
            "version": debian_version(config.version),
        },
    )
    write_text(control_dir / "control", control, 0o644)

    artifact = config.dist_dir / "chipmunk@{}-linux-{}.deb".format(
        config.version, arch
    )
    run(
        ["dpkg-deb", "--build", "--root-owner-group", str(root), str(artifact)],
        error="Creating Debian package failed",
    )
    return artifact


def build_rpm(config: LinuxPackageConfig, work_dir: Path) -> Path:
    ensure_tools(["desktop-file-validate", "rpm", "rpmbuild"])

    root = work_dir / "root"
    stage_install_tree(config, root, package_format="rpm")
    validate_desktop_file(root)

    sources_dir = work_dir / "SOURCES"
    specs_dir = work_dir / "SPECS"
    make_dir(sources_dir, 0o755)
    make_dir(specs_dir, 0o755)

    source = sources_dir / "chipmunk-linux-install.tar.gz"
    write_install_tar(root, source)

    rpm_version, rpm_release = rpm_version_release(config.version)
    spec = render_template(
        "rpm/chipmunk.spec.in",
        {
            "release": rpm_release,
            "source": source.name,
            "version": rpm_version,
        },
    )
    spec_path = specs_dir / "chipmunk.spec"
    write_text(spec_path, spec, 0o644)

    run(
        [
            "rpmbuild",
            "--define",
            "_topdir {}".format(work_dir),
            "-bb",
            str(spec_path),
        ],
        error="Creating RPM package failed",
    )

    built = sorted((work_dir / "RPMS").rglob("chipmunk-*.rpm"))
    if not built:
        raise RuntimeError("RPM build finished without producing a package")

    arch = rpm_architecture()
    artifact = config.dist_dir / "chipmunk@{}-linux-{}.rpm".format(
        config.version, arch
    )
    shutil.copy2(built[0], artifact)
    artifact.chmod(0o644)
    return artifact


def stage_install_tree(
    config: LinuxPackageConfig, root: Path, package_format: str
) -> None:
    reset_dir(root)

    install_file(config.app_binary, root / "usr" / "bin" / PACKAGE_NAME, 0o755)
    install_file(
        config.desktop_file,
        root / "usr" / "share" / "applications" / "chipmunk.desktop",
        0o644,
    )

    for size in ICON_SIZES:
        install_file(
            config.icon_dir / "{}.png".format(size),
            root
            / "usr"
            / "share"
            / "icons"
            / "hicolor"
            / "{}x{}".format(size, size)
            / "apps"
            / "chipmunk.png",
            0o644,
        )

    doc_dir = root / "usr" / "share" / "doc" / PACKAGE_NAME
    install_file(config.readme, doc_dir / "README.md", 0o644)

    if package_format == "deb":
        copyright_text = render_template(
            "debian/copyright.in",
            {"source": "https://github.com/esrlabs/chipmunk"},
        )
        write_text(doc_dir / "copyright", copyright_text, 0o644)
    elif package_format == "rpm":
        install_file(
            config.license_file,
            root / "usr" / "share" / "licenses" / PACKAGE_NAME / "LICENSE.txt",
            0o644,
        )
    else:
        raise RuntimeError("Unknown Linux package format: {}".format(package_format))

    normalize_directory_modes(root)


def deb_dependencies(binary: Path, work_dir: Path) -> str:
    debian_dir = work_dir / "debian"
    make_dir(debian_dir, 0o755)
    write_text(
        debian_dir / "control",
        render_template("debian/shlibdeps-control.in", {}),
        0o644,
    )

    result = run_capture(
        ["dpkg-shlibdeps", "-O", "-e{}".format(binary)],
        cwd=work_dir,
        error="Resolving Debian shared-library dependencies failed",
    )

    for line in result.stdout.splitlines():
        if line.startswith("shlibs:Depends="):
            return line.split("=", 1)[1].strip()
    return ""


def deb_control_depends(dynamic_depends: str) -> str:
    depends = list(DEB_STATIC_DEPENDS)
    if dynamic_depends:
        depends.append(dynamic_depends)
    return ", ".join(depends)


def debian_version(version: str) -> str:
    core, prerelease, build = split_semver(version)
    upstream = core
    if prerelease:
        upstream += "~{}".format(sanitize_debian_part(prerelease))
    if build:
        upstream += "+{}".format(sanitize_debian_part(build))
    return "{}-{}".format(upstream, DEB_REVISION)


def rpm_version_release(version: str) -> Tuple[str, str]:
    core, prerelease, build = split_semver(version)
    release_parts = []
    if prerelease:
        release_parts.extend([RPM_PRERELEASE_PREFIX, sanitize_rpm_part(prerelease)])
    else:
        release_parts.append(RPM_STABLE_RELEASE)
    if build:
        release_parts.append(sanitize_rpm_part(build))
    return core, ".".join(part for part in release_parts if part)


def split_semver(version: str) -> Tuple[str, Optional[str], Optional[str]]:
    match = SEMVER_RE.match(version)
    if not match:
        raise RuntimeError("Unsupported package version: {}".format(version))
    return (
        match.group("core"),
        match.group("prerelease"),
        match.group("build"),
    )


def sanitize_debian_part(value: str) -> str:
    return sanitize(value, allowed=r"A-Za-z0-9.+~", replacement=".")


def sanitize_rpm_part(value: str) -> str:
    return sanitize(value, allowed=r"A-Za-z0-9._", replacement=".")


def sanitize(value: str, allowed: str, replacement: str) -> str:
    sanitized = re.sub(r"[^{}]+".format(allowed), replacement, value)
    sanitized = re.sub(r"\.+", ".", sanitized).strip(".")
    if not sanitized:
        raise RuntimeError("Version segment became empty after sanitizing: {}".format(value))
    return sanitized


def deb_architecture() -> str:
    return run_capture(
        ["dpkg", "--print-architecture"],
        error="Resolving Debian architecture failed",
    ).stdout.strip()


def rpm_architecture() -> str:
    arch = run_capture(
        ["rpm", "--eval", "%{_target_cpu}"],
        error="Resolving RPM architecture failed",
    ).stdout.strip()
    return arch or platform.machine()


def installed_size_kib(root: Path) -> int:
    total = 0
    for path in root.rglob("*"):
        if path.is_file() and "DEBIAN" not in path.relative_to(root).parts:
            total += path.stat().st_size
    return max(1, (total + 1023) // 1024)


def validate_desktop_file(root: Path) -> None:
    run(
        [
            "desktop-file-validate",
            str(root / "usr" / "share" / "applications" / "chipmunk.desktop"),
        ],
        error="Validating Linux desktop file failed",
    )


def write_install_tar(root: Path, archive: Path) -> None:
    with tarfile.open(archive, "w:gz") as tar:
        for path in sorted(root.iterdir(), key=lambda item: item.name):
            tar.add(path, arcname=path.name, filter=root_owned_tar_info)
    archive.chmod(0o644)


def root_owned_tar_info(tar_info: tarfile.TarInfo) -> tarfile.TarInfo:
    tar_info.uid = 0
    tar_info.gid = 0
    tar_info.uname = "root"
    tar_info.gname = "root"
    return tar_info


def render_template(relative_path: str, values: Dict[str, str]) -> str:
    template = templates_root() / relative_path
    return template.read_text(encoding="utf-8").format(**values)


def install_file(source: Path, destination: Path, mode: int) -> None:
    if not source.exists():
        raise RuntimeError("Required packaging input is missing: {}".format(source))
    make_dir(destination.parent, 0o755)
    shutil.copy2(source, destination)
    destination.chmod(mode)


def write_text(path: Path, content: str, mode: int) -> None:
    make_dir(path.parent, 0o755)
    path.write_text(content, encoding="utf-8")
    path.chmod(mode)


def make_dir(path: Path, mode: int) -> None:
    path.mkdir(parents=True, exist_ok=True)
    path.chmod(mode)


def normalize_directory_modes(root: Path) -> None:
    root.chmod(0o755)
    for path in root.rglob("*"):
        if path.is_dir():
            path.chmod(0o755)


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)
    path.chmod(0o755)


def ensure_linux_host() -> None:
    if platform.system() != "Linux":
        raise RuntimeError("Linux installers can only be created on Linux")


def ensure_tools(tools: Iterable[str]) -> None:
    missing = [tool for tool in tools if shutil.which(tool) is None]
    if missing:
        raise RuntimeError("Missing Linux packaging tools: {}".format(", ".join(missing)))


def run(command: List[str], error: str, cwd: Optional[Path] = None) -> None:
    result = subprocess.run(command, cwd=cwd)
    if result.returncode != 0:
        raise RuntimeError(error)


def run_capture(
    command: List[str], error: str, cwd: Optional[Path] = None
) -> subprocess.CompletedProcess:
    result = subprocess.run(
        command,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.stderr:
        print(result.stderr, end="")
    if result.returncode != 0:
        raise RuntimeError("{}: {}".format(error, result.stderr.strip()))
    return result


def templates_root() -> Path:
    return Path(__file__).resolve().parent / "templates"
