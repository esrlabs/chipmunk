Thank you for your interest in contributing to Chipmunk! This document provides a guide to setting up your development environment and making contributions. Chipmunk is developed using [Rust](https://www.rust-lang.org/) for the backend processing and [ElectronJS](https://www.electronjs.org/) for the frontend application.

## Prerequisites

To build and run Chipmunk locally, ensure you have the following languages installed on your system:

1. Rust
2. NodeJS

To conveniently check if all prerequisites are met, you can run the provided shell script from the root of the repository in your terminal:

```sh
sh developing/scripts/check.sh
```

If the script indicates success (e.g., prints success messages), you have all necessary prerequisites and can proceed to [installing dependencies](/chipmunk/contributing/preparing). 
If the script reports that prerequisites are missing, please install them before continuing with the setup.


## Chipmunk Logs & Configurations

Chipmunk's log files and their associated configuration files are located within the Chipmunk home directory:

### Log Files:

* **chipmunk.log:** Logs for the Chipmunk Electron frontend.
* **chipmunk.indexer.log:** Logs for the Chipmunk Rust backend (indexer).
* **chipmunk.updater.log:** Logs for the Chipmunk updater binary.
* **chipmunk.launcher.log:** Logs for the Chipmunk application during backend initialization and communication channel setup.

### Configuration Files:

Chipmunk's backend logging is configured using the [log4rs](https://docs.rs/log4rs/latest/log4rs/index.html) crate. To adjust log levels, appenders, or other logging settings, modify the relevant YAML configuration files.

The following log configuration files are available:

* **log4rs.yaml:** Configuration file for the Rust backend. (Note: Please keep the first line of this file unchanged, as it is used for version control of log files.)
* **log4rs_updater.yaml:** Configuration file for the updater tool.
