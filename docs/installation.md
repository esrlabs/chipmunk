`chipmunk` is available as a prebuilt desktop application from the [GitHub releases page](https://github.com/esrlabs/chipmunk/releases). Release builds include the built-in updater, so the application can notify you and update itself when a newer version is available.

You can also install the native application from source with Cargo:

```sh
cargo install --path crates/app --locked
```

If you use [`just`](https://github.com/casey/just), the same installation is available through the repository recipe:

```sh
just install-app
```

### macOS

Download the macOS release and move `chipmunk.app` to your Applications folder.

Or install using Homebrew:

```sh
brew install --cask chipmunk
```

### Windows

Download and unpack the Windows release to a folder of your choosing. Use `chipmunk.exe` to start Chipmunk.

Requirements:

- Install the latest [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170).

### Linux

Download and unpack the Linux release to a folder of your choosing. Use the `chipmunk` executable to start Chipmunk.

Each release also provides `.deb` and `.rpm` packages.
