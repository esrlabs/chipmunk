This guide covers debugging the Chipmunk application, including logs and component-specific procedures

## Debugging Procedures

### Frontend Components

The Chipmunk frontend consists of multiple components, each with a different debugging method.

#### Debugging Electron App

To debug the Electron `holder` application, located at `{CHIPMUNK_ROOT}/application/holder`, a debug session can be invoked directly from VS Code or any debugger that supports its launch configurations.

A standard launch configuration object must be added to your debugger's settings. This configuration should point to the Electron executable and the application's entry point.

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Electron",
  "runtimeExecutable": "${workspaceRoot}/application/holder/node_modules/.bin/electron",
  "program": "${workspaceRoot}/application/holder/src/app.ts",
  "outFiles": ["${workspaceRoot}/application/holder/dist/**/*.js"]
}
```

Before starting each debug session, you must build the application with the development CLI tool via:

```sh
cargo chipmunk build app
```

#### Debugging Client

The application `client`, located at `{CHIPMUNK_ROOT}/application/client`, is a standard web application that you can debug using the built-in **Chromium Developer Tools**.

**1. Opening Developer Tools**

You can open the developer tools in several ways:

* **Menu:** Select `Chipmunk` -> `Developing` -> `Toggle Developer Tools`.
* **Shortcut:** Press **Ctrl + Shift + I**.
* **Environment Variable:** Set `CHIPMUNK_DEVELOPING_MODE=true` before launching the application.

**2. Using the Debugger**

Once the developer tools are open, you can:
* Inspect `console.log()` output in the **Console** tab.
* Set breakpoints in the source code under the **Sources** tab, located at `webpack:///./src/`.

#### Debugging Communication Libraries

Chipmunk uses several shared libraries to facilitate communication between the Rust backend and the frontend components.

You can debug these libraries using the same VS Code workflow as the Electron `holder`. However, because these libraries are copied into the `holder`'s `node_modules` directory during the build process, you'll need to use the specific debug paths listed below.

* **`platform`**: Provides shared type definitions for frontend projects. Debug at `{CHIPMUNK_ROOT}/application/holder/node_modules/platform`.
* **`ts-bindings`**: Includes type definitions for Rust-to-Electron communication. Debug at `{CHIPMUNK_ROOT}/application/holder/node_modules/rustcore/ts-bindings`.

----

### Rust Backend

The recommended methods for debugging the Rust backend are print-based debugging and structured logging.

You can use Rust's standard printing macros for immediate feedback during development. For more persistent and configurable diagnostics, the backend uses a logging framework, which is the primary method for monitoring the application's behavior.

The configuration for this logging system is detailed in the next section.

----

## Logs and Configuration Files

Checking the log output is the first step in diagnosing most issues. Chipmunk's log files and their configurations are located within the Chipmunk home directory.

### Log Files

* `chipmunk.log`: Logs for the Chipmunk Electron frontend.
* `chipmunk.indexer.log`: Logs for the Chipmunk Rust backend (indexer).
* `chipmunk.updater.log`: Logs for the Chipmunk updater binary.
* `chipmunk.launcher.log`: Logs for the application during backend initialization.

### Configuration Files

Backend logging is configured using the [log4rs](https://docs.rs/log4rs/latest/log4rs/index.html) crate. To adjust log levels or other settings, modify the relevant YAML files.

* `log4rs.yaml`: Configuration for the Rust backend. (Note: The first line of this file is used for version control and should not be changed.)
* `log4rs_updater.yaml`: Configuration for the updater tool.
