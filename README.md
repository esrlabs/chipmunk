[![LICENSE](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.txt)
[![](https://github.com/esrlabs/chipmunk/actions/workflows/release_next.yml/badge.svg)](https://github.com/esrlabs/chipmunk/actions/workflows/release_next.yml)
[![](https://github.com/esrlabs/chipmunk/actions/workflows/lint_master.yml/badge.svg)](https://github.com/esrlabs/chipmunk/actions/workflows/lint_master.yml)

# Chipmunk Log Analyzer & Viewer

`chipmunk` is a fast logfile viewer that can deal with huge logfiles (>10 GB). It powers a super
fast search and is supposed to be a useful tool for developers who have to analyze logfiles.

## Download/Installation

The latest chipmunk release can be downloaded [here](https://github.com/esrlabs/chipmunk/releases).

We support **MacOS**, **Linux** and **Windows**.

No installation is necessary, just download, unpack and execute.

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

## Chipmunk CLI Tool

We provide a command-line tool to facilitate data parsing from multiple input sources and with support for various parser formats. For more details, refer to the [Chipmunk CLI Tool](cli/chipmunk-cli/README.md).

## Development CLI Tool

We provide a CLI tool to assist with various development tasks. For more details, refer to the [Chipmunk Development CLI Tool](cli/development-cli/README.md).

## Contributing
See our [contribution](contribution.md) guide for details

## Documentation / User Manual
Discover [documentation](application/client/src/assets/documentation/about.md) to see all features of Chipmunk.
