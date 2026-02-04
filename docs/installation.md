
`chipmunk` is distributed as a portable version and does not require any installation - just download and run. Additionally:

- It does not install or depend on any external libraries or runtime environments (with a small exception for Windows).
- It includes a built-in update mechanism (you will be notified when a new version is available).
- It is available for **Linux**, **Windows**, and **macOS** platforms.

### Download

The latest chipmunk release can be downloaded [here](https://github.com/esrlabs/chipmunk/releases).

### Mac OS

Move `chipmunk.app` to your application folder.

Or using Homebrew
```
brew install --cask chipmunk
```

### Windows

Unpack chipmunk to a folder of your choosing. Use the `chipmunk.exe` to start chipmunk.

Requirements:
- should be installed a latest package of [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)


### Linux

Unpack chipmunk to a folder of your choosing. Use the `chipmunk` executable to start chipmunk. 

Additionally, each `chipmunk` release comes with `deb` and `rpm` packages.

### Ubuntu 24.04 and newer

Ubuntu 24.04 introduced stricter **AppArmor** restrictions that may prevent the Electron sandbox from working correctly when running the **portable version** of Chipmunk.

In some cases, Chipmunk may start normally when launched from the **GUI**, but fail when started from the **terminal**.

If you require running Chipmunk from the terminal, we recommend installing it using the provided **`.deb` or `.rpm` package**.

If Chipmunk fails to start with an error similar to:
```
FATAL:setuid_sandbox_host.cc(163)
```
run the following helper script to enable the required AppArmor profile for Chipmunk:
```
sudo ./scripts/os/ubuntu_enabler.sh
```
