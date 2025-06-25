# Plugin Templates in C/C++

This directory contains ready-to-use templates for Chipmunk plugins written in C/C++. 
Plugin developers can simply copy a template directory to quickly start a new plugin project.

## Step-by-Step Guide

1. **Prerequisites**: Ensure all necessary tools, SDKs, and Chipmunk WIT files are available locally. Refer to the [C/C++ Plugins Development Guide](https://esrlabs.github.io/chipmunk/plugins/development-guide/) for detailed setup instructions.

2. **Configuration**: Provide required paths either directly within the `Makefile` or by passing them as arguments to the `make` CLI command.

3. **Compilation**: Run `make all {arguments}` to compile the template plugins. This command performs the following actions:
  * Generates bindings from Chipmunk WIT files.
  * Downloads the latest `wasi reactor` if its path is not specified.
  * Generates the plugin WASM component file in the `dist` directory. For parser templates, the file will be named `my_parser.wasm`.

4. **Plugin Integration**: To integrate the compiled plugin into Chipmunk:
  1.  Create a directory for your plugin within the Chipmunk plugins directory. For parser plugins, this path is `~/.chipmunk/plugins/parsers`. The directory name for this template example would be `my_parser`.
  2.  Copy the compiled plugin WASM component file into the newly created directory.
  3.  For more detailed integration steps, refer to the [Plugins Integration Documentation](https://esrlabs.github.io/chipmunk/plugins/development-guide/#building-and-integrating-plugins).

5. **Using Plugins in Chipmunk**:
  1.  Navigate to the **Plugins Manager** in the Chipmunk UI to verify that your plugin is integrated and validated successfully.
  2.  Start a session, for example, a CLI command session from *Terminal/Execute Command*.
  3.  Select your plugin from the dropdown menu. For the parser template, it will be named `my_parser`.
  4.  The configuration schemas defined by the plugin will be displayed on the UI, allowing you to provide necessary inputs.
  5.  Start the session to view the parsed messages. If Chipmunk is running in a terminal, you can also check logs printed to standard output.
  6.  For additional details and demonstrations, refer to the [Plugins Integrations in Chipmunk UI](https://esrlabs.github.io/chipmunk/plugins/integration-ui/).
