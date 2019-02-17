# Developing documentation
## Structure of folders
```
├── application
│   ├── apps                                        # Support (helpers) applications
│   │   └── tsnodeappinstaller
│   ├── client.core                                 # Core of render. Based on Angular
│   │   ├── dist                                    # Output folder for builds
│   │   ├── platform -> link                        # Link to platform folder (collection of common helpers and reusable libs)
│   │   └── src                                     # code of render's core
│   │       ├── app
│   │       │   ├── environment
│   │       │   │   ├── apps
│   │       │   │   ├── components                  # collection of core components. This components can be used only by core, but not by plugins
│   │       │   │   ├── controller                  # controllers used in app
│   │       │   │   ├── layout                      # layout of main view
│   │       │   │   ├── services                    # services of app
│   │       │   │   ├── theme                       # defitions of parameters of app theme (based on LESS)
│   │       │   │   └── tools                       # collection of tools/helpers
│   │       ├── assets                              # resources files: fonts, images etc.
│   │       └── environments
│   ├── client.libs                                 # storage of libraries to be used in plugins (in scope of render process)
│   │   └── logviewer.client.components             # collection of reusable/shared components
│   │       └── projects
│   │           ├── logviewer-client-complex        # complex components like docks, tabs etc.
│   │           ├── logviewer-client-containers     # components which wraps content, like dynamic injector, frames etc.
│   │           └── logviewer-client-primitive      # priimitive components: buttons, lists etc.
│   ├── client.plugins                              # sandbox for creating plugins (in scope of render process only)
│   ├── electron                                    # electron part of solution
│   │   ├── dist                                    # output folder for builds
│   │   ├── platform -> link                        # Link to platform folder (collection of common helpers and reusable libs)
│   │   └── src                                     # Sources of electron app
│   │       ├── classes                             # Patterns of classes
│   │       ├── controllers                         # Controlles used in app
│   │       │   ├── electron.ipc.messages           # Collection of electron IPC messages (render <-> electron)
│   │       │   └── plugin.ipc.messages             # Collection of plugin IPC messages (electron <-> plugin host)
│   │       ├── interfaces                          # Interfaces
│   │       ├── services                            # Application services
│   │       └── tools                               # Collection of tools/helpers
│   ├── node.libs                                   # storage of libraries to be used in plugins (in scope of node process)
│   │   └── logviewer.plugin.ipc                    # IPC for communication: electron <-> plugin host
│   ├── platform                                    # collection of common helpers and reusable libs
│   │   ├── cross                                   # can be used in render and in node proceses
│   │   ├── node                                    # can be used only on node level
│   │   └── web                                     # can be used only on web level
│   └── sandbox                                     # sendbox to develop plugin
│       └── terminal
│           ├── process
│           └── render
└── docs                                            # files related this documentation
    └── assets
```



# Plugin based system

![](https://raw.githubusercontent.com/DmitryAstafyev/logviewer/v2/docs/assets/basic_plugins_scheme.svg?sanitize=true)
