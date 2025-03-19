# 0.2.0

## Changes:

* Enhanced auto-reconnect to TCP server with optional `keepalive` probes.
* Added new CLI arguments for configuring TCP `keepalive` probes.  
* Change unit for intervals from milliseconds to seconds.
* Improved performance and reliability of parse sessions.  
* Improved parse error handling to minimize data loss and enhance app responsiveness.  

# 0.1.0

## Features:

* **Multiple Input Sources**: Supports TCP, UDP sockets, and files as input sources for data.
* **Parser Support**: Implements the DLT (Diagnostic Log and Trace) parser, supporting multiple FIBEX files for parsing.
* **Reconnection Support**: Automatic reconnection to TCP servers when the connection is lost, configurable via CLI arguments.
* **Text and Binary Output Formats**: Ability to export parsed data to both text and binary formats.
* **Status Updates**: Provides real-time status updates during operation via printing to stdout, configurable through CLI.
* **Flexible CLI Structure**: Supports running multiple parsers with different input sources via a hierarchical CLI structure.
* **Extensive Documentation**: Detailed README with installation instructions, usage examples, and descriptions of available parsers and input sources.
