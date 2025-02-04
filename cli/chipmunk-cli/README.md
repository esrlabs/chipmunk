[![LICENSE](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.txt)
[![](https://github.com/esrlabs/chipmunk/actions/workflows/lint_master.yml/badge.svg)](https://github.com/esrlabs/chipmunk/actions/workflows/lint_master.yml)

# Chipmunk CLI Tool  

Chipmunk CLI is a command-line tool designed to connect to multiple data sources, process incoming data, and write the output to a file in both binary and text formats. It supports:  

- Connecting to TCP, UDP sockets, and files as input sources.  
- Parsing data using various formats.  
- Writing processed data to binary and text output formats.  
- Reconnecting to TCP servers when configured.  
- Providing status updates while running.  

For details on supported parsers and input sources, see the sections below.  

## Table of Contents

- [Build/Installation](#buildinstallation)
  - [Prerequisites](#prerequisites)
  - [Install Chipmunk CLI](#install-chipmunk-cli)
- [Usage](#usage)
- [Supported Parsers](#supported-parsers)
  - [DLT (Diagnostic Log and Trace)](#dlt-diagnostic-log-and-trace)
- [Supported Input Sources](#supported-input-sources)
  - [TCP Socket](#tcp-socket)
  - [UDP Socket](#udp-socket)
  - [File Input](#file-input)
- [Examples](#examples)
- [Changelogs](#changelogs)
- [Contributing](#contributing)


## Build/Installation

### Prerequisites

Before installing the Chipmunk CLI tool, ensure that Rust is installed on your system. If Rust is not yet installed, follow the official installation instructions for your platform:

- **Install Rust:** Visit [rustup.rs](https://rustup.rs/) and follow the instructions to install Rust.

### Install Chipmunk CLI

Navigate to the root directory of the Chipmunk repository in your terminal and run the following command to install the Chipmunk CLI tool:

```bash
cargo install --path cli/chipmunk-cli
```
This command installs the tool `chipmunk-cli`, allowing you to use `chipmunk-cli <ARGS> <COMMAND>` to execute parsing tasks using multiple parsers and input sources.


## Usage

To see available command-line options, run:

```shell
chipmunk-cli --help
```

```
CLI Tool for parsing bytes form different source supporting multiple data formats
version: 0.1.0

Usage: chipmunk-cli [OPTIONS] --output <OUTPUT_PATH> <COMMAND>

Commands:
  dlt   Establishes a DLT session using the configured parser
  help  Print this message or the help of the given subcommand(s)

Options:
  -o, --output <OUTPUT_PATH>
          Specify the path for the output file

  -f, --output-format <OUTPUT_FORMAT>
          Specify the format of the output

          [default: binary]

          Possible values:
          - binary: Output in binary format
          - text:   Parsed output as text

  -a, --append-output
          Appends to the output file if it exists, rather than returning an error

      --cols-sep <TEXT_COLUMNS_SEPARATOR>
          Sets the column separator for parsed data in text output

          [default: " , "]

      --args-sep <TEXT_ARGS_SEPARATOR>
          Sets the argument separator for payload column in text output

          [default: " ; "]

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version
```

Chipmunk supports configuring and running multiple parsers with various input source in a generic way with multiple level of CLI subcommands.
To run a command users need to specify the output options at first alongside with other optional global flags then they need to specify the parser in its configurations as a subcommand, finally they need to specify the input source as final subcommand next to its configurations. Here are some example:
Reading data from a TCP server with the address `127.0.0.1:7777` with reconnecting configured to retry for 1000 times, then parsing data in DLT with multiple FIBEX files and exporting the data in binary format appending to the end of the output file if exists.
```shell
chipmunk-cli -o ~/Desktop/chip_output/logs.dlt -a -f binary dlt -f ~/Fibex/file1.xml -f ~/Fibex/file1.xml tcp 127.0.0.1:7777 -m 1000
```

## Supported Parsers:

### DLT (Diagnostic Log and Trace)

Chipmunk can parse DLT messages from various sources and export the output in both text and binary formats. It also supports **FIBEX metadata files**.

```shell
$ chipmunk-cli dlt --help
Establishes a DLT session using the configured parser

Usage: chipmunk-cli --output <OUTPUT_PATH> dlt [OPTIONS] <COMMAND>

Commands:
  tcp   Establish a TCP connection using the specified IP address as the input source
  udp   Establish a UDP connection using the specified IP address as the input source
  file  Read input from a file at the specified path
  help  Print this message or the help of the given subcommand(s)

Options:
  -f, --fibex-files <FIBEX_FILES>  The paths to the FIBEX files used for this parsing session
  -h, --help                       Print help
```

When exporting to **binary format**, Chipmunk automatically generates a default **storage header** for each message if one is not already present.


## Supported Input Sources:

### TCP Socket

Chipmunk can establish a connection with a **TCP server**, receive data from it, and parse it. It also supports **automatic reconnection** if the connection is lost.
Reconnection is enabled **only** when the `--max-reconnect` option is specified. If not set, the session will terminate as soon as the connection to the server is lost.

```shell
$ chipmunk-cli dlt tcp --help
Establish a TCP connection using the specified IP address as the input source

Usage: chipmunk-cli dlt tcp [OPTIONS] <ADDRESS>

Arguments:
  <ADDRESS>  The address to bind the connection to

Options:
  -u, --update-interval <UPDATE_INTERVAL>
          Time interval (in milliseconds) to print current status [default: 5000]
  -m, --max-reconnect <MAX_RECONNECT_COUNT>
          Maximum number of reconnection attempts if the connection is lost
  -r, --reconnect-interval <RECONNECT_INTERVAL>
          Time interval (in milliseconds) between reconnection attempts [default: 1000]
  -h, --help
          Print help
```

### UDP Socket:

Chipmunk can receive data from a **UDP socket**, continuously processing incoming messages from a specified address. 
Since UDP is connectionless by design, Chipmunk will automatically handle incoming packets without requiring reconnection logic.

```shell
$ chipmunk-cli dlt udp --help
Establish a UDP connection using the specified IP address as the input source

Usage: chipmunk-cli dlt udp <ADDRESS>

Arguments:
  <ADDRESS>  The address to bind the connection to

Options:
  -h, --help  Print help
```

### File Input  

Chipmunk can read and parse data from a **local file**, allowing you to process previously captured logs or recorded data. 

```shell
$ chipmunk-cli dlt file --help
Read input from a file at the specified path

Usage: chipmunk-cli dlt file <PATH>

Arguments:
  <PATH>  Path to the input file

Options:
  -h, --help  Print help
```

## Examples  

Chipmunk provides a flexible way to configure and run multiple parsers with various input sources using a structured CLI format with multiple levels of subcommands.  

To execute a command, users first specify **output options** along with any **global flags**. Next, they define the **parser** and its configurations as a subcommand. Finally, they specify the **input source** and its settings as the last subcommand.  

### Binary DLT on TCP  

Reads data from a TCP server at `127.0.0.1:7777`, enabling automatic reconnection with up to 1000 retries. The data is parsed using the DLT format with multiple FIBEX files and exported in binary format, appending to the output file if it already exists.  

```shell
chipmunk-cli -o ~/Output/logs.dlt -a -f binary dlt -f ~/Fibex/file1.xml -f ~/Fibex/file2.xml tcp 127.0.0.1:7777 -m 1000
```

### Text DLT from Binary File  

Reads DLT binary data from a local file, parses it into text, and formats the output using the default separators for columns and payload arguments.  

```shell
chipmunk-cli -o ~/Output/logs.log -f text dlt file ~/DLT/file.dlt
```  

## Changelogs:

Changelogs can be found [here](CHANGELOG.md)

## Contributing

Contributions in any part of Chipmunk are very welcome!

Please see our [main contribution guid](../../contribution.md)


