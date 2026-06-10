`chipmunk` is available as a prebuilt desktop application from the [GitHub releases page](https://github.com/esrlabs/chipmunk/releases). Release builds include the built-in updater, so the application can notify you and update itself when a newer version is available. The built-in updater supports both installer-based and portable installations.

You can also install the native application from source with Cargo:

```sh
cargo install --path crates/app --locked
```

If you use [`just`](https://github.com/casey/just), the same installation is available through the repository recipe:

```sh
just install-app
```

### macOS

Download one of the macOS release artifacts:

- `.pkg` installer, which installs Chipmunk into Applications
- portable `.tgz` archive containing `chipmunk.app`

For the portable archive, unpack it and move `chipmunk.app` to your Applications folder.

### Windows

Download one of the Windows release artifacts:

- `.msi` installer, which installs Chipmunk into Program Files
- portable `.tgz` archive containing `chipmunk.exe`

For the portable archive, unpack it to a folder of your choosing and use `chipmunk.exe` to start Chipmunk.

Requirements:

- Install the latest [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170).

### Linux

Download one of the Linux release artifacts:

- `.deb` package for Debian/Ubuntu-based distributions
- `.rpm` package for Fedora/RHEL/openSUSE-based distributions
- portable `.tgz` archive containing the `chipmunk` executable

For the portable archive, unpack it to a folder of your choosing and use the `chipmunk` executable to start Chipmunk.
