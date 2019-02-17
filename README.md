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

> **Note**. Any electron based application has two parts: render process and node (main) process. Render process is a HTML page with attached JS and CSS files. The main process - is a node-process.
> Communication between render and main processes could be organized in a few ways: using a network (the main process creates WebSocket server for example and a client connects to it) and using electron IPC. The second way (IPC) gives much more performance, but not scalable to web version of application. Because electron application is a major version of logviewer, we are using electron IPC.

Here is basic scheme of solution's components

![](https://raw.githubusercontent.com/DmitryAstafyev/logviewer/v2/docs/assets/basic_plugins_scheme.svg?sanitize=true)

## Plugin structure

```
├── process
│   ... sources folders/files
│   └── package.json
└── render
    ... sources folders/files
    │
    └── package.json
```

Plugin could have process implementation and render implementation.
- process implementation - application will be runned as forked node-process on electron level.
- render implementation - application will be runned as Angular module on render process

> **Note**. Plugin could have process and render implementations or just one of it: only process or only render.

If folder **process** or **render** doesn't have package.json file - this part will be ignored.

### Requirements

| Part of plugin | Requirements | Permissions |
| --- | --- | --- |
| process (node) | javascript | - can be used external npm packages <br/>- full access to OS |
| render | - typescript<br/>- Angular 7<br/> | - injected as Angular module into main process (without using WebWorkers)<br/>- has API to communication with plugin host |

### package.json of plugin parts
package.json of plugin should have fields:
- **logviewer_version** - version of logviewer, which plugin supports
- **main** - path to entry-point of plugin
```
{
  "name": "name_of_plugin",
  "version": "0.0.1",
  "logviewer_version": "1.0.0",
  "main": "./dist/main.js",
  ...
}
```
## Plugins installation/loading workflow
![](https://raw.githubusercontent.com/DmitryAstafyev/logviewer/v2/docs/assets/plugin_loading_scheme.svg?sanitize=true)

Loading **plugin host** workflow includes:

- [**main process**] Reading package.json and check **aviability** of main file
- [**main process**] Checking version of plugin
- [**main process**] If plugin isn't installed (node_modules folder doesn't exist) 
  - install plugin 
  - rebuild binary files (needed to prevent NODE versions conflict, because electron NODE version could dismatch with NODE version of host machine)
- [**main process**] Execute **main** plugin host file as standalone forked node-process

Loading **plugin render** workflow includes:
- [**main process**] Reading package.json and check **aviability** of main file
- [**main process**] Checking version of plugin
- [**main process**] Sending path to main TS (TypeScript) file (with Angular module implementation) to render process
- [**render process**] Loading TS file of plugin
- [**render process**] Initialization Angular module from TS file
- [**render process**] Initialization of plugins apps: view, status bar app, tab app, parser etc.
- [**render process**] Delivery plugin API to plugin angular module

> **Note**. In scope of render part, API of core delivery not only to Angular module of plugin, but also to each plugin Angular component. Developer of plugin should not care about "sharing" API via components, because each component will got it.

## Plugins communication: basic scheme
![](https://raw.githubusercontent.com/DmitryAstafyev/logviewer/v2/docs/assets/components_communication.svg?sanitize=true)

> **Note**. Plugin render and plugin host don't have direct communication channel. All communication betweet it happens via "main render channel"

## Plugins communications: node level (electron)

Main process creates fork of plugin host process with defined communication channel IPC and addition Stream.
- **IPC** used for messaging between plugin host and electron
- **Stream** used to delivery data from plugin host into main data stream of logviewer.

To be able communication with main process plugin should have installed library (npm module) **logviewer.plugin.ipc**

```
npm install logviewer.plugin.ipc --save
```
> Note. Library not published yet and should be copied into node_modules folder of plugin manually.

Let's see how it could be used on plugin level.

```typescript
import PluginIPCService from 'logviewer.plugin.ipc';
import { IPCMessages } from 'logviewer.plugin.ipc';

class Plugin {

    constructor() {
        // Subscribe to message/event "PluginRenderMessage"
        PluginIPCService.subscribe(IPCMessages.PluginRenderMessage, this._onCommand.bind(this));
    }

    private _onCommand(message: IPCMessages.PluginRenderMessage, response: (res: IPCMessages.TMessage) => any) {
        // All income messages/events has as second argument handler to send data back (response) to sender of message/event
        const command = message.data.command;
        switch (command) {
            case 'ping':
                return response(new IPCMessages.PluginRenderMessage({
                    data: {
                        answer: 'pong'
                    }
                }));;
            case 'what_time_is_it':
                return response(new IPCMessages.PluginRenderMessage({
                    data: {
                        time: Date.now()
                    }
                }));
        }
    }

    public sendToPluginRender(str: string) {
        // Will send data to plugin render (if it exsist)
        PluginIPCService.sendToPluginHost(str);
    }

    public sendToMainDataStream(str: string) {
        // Will send data to main data's stream of application
        PluginIPCService.sendToStream(str);
    }

}

const app: Plugin = new Plugin();

app.sendToPluginRender('Hello World!');
app.sendToMainDataStream(`this is very important data, which should posted into data's stream`);

```

API of PluginIPCService
| Name | Interface | Description |
| --- | --- | --- |
| sendToPluginHost | **sendToPluginHost**(message: any): Promise\<any\> | Sends message to plugin render part. Resolved on success of sending. |
| requestToPluginHost | **requestToPluginHost**(message: any): Promise\<any\>  | Sends to plugin render part request. Will be resolved with response only. |
| send | **send**(message: IPCMessages.TMessage): Promise\<IPCMessages.TMessage \| undefined\> | Sends message to electron main process. Resolved on success of sending. |
| request | **request**(message: IPCMessages.TMessage): Promise\<IPCMessages.TMessage \| undefined\> | Sends request to main electron process. Will be resolved with response only. |
| subscribe | **subscribe**(message: Function, handler: THandler): Promise\<Subscription\> | Start listen income message/event of defined type. Resolved with an instance of Subscription class to have a way unsubscribe. |
| sendToStream | **sendToStream**(chunk: any): Promise\<void\> | Sends data to electron main process to main stream data |
| getDataStream | **getDataStream**(): FS.WriteStream | Returns reference to stream "channel". Could be used to *pipe* streams. |

## Plugins communications: render level (Angular)

Main render process delivery to plugin instance of **ControllerPluginIPC**
Module of plugin could get it if method **setAPI** will be defined in module

```typescript
import { NgModule } from '@angular/core';
import { ViewComponent } from './view/component';
import { CommonModule } from '@angular/common';
import ControllerPluginIPC from 'logviewer.render.plugin.ipc';

@NgModule({
    entryComponents: [ViewComponent],
    declarations: [ViewComponent],
    imports: [ CommonModule ],
    exports: [ViewComponent]
})

export class PluginModule {

    private _api: ControllerPluginIPC | undefined;

    public setAPI(api: ControllerPluginIPC) {
        this._api = api;
    }

}
```

Any component of plugin could get reference to instance of **ControllerPluginIPC** via **input**.

```typescript
import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input } from '@angular/core';
import ControllerPluginIPC from 'logviewer.render.plugin.ipc';

@Component({
    selector: 'lib-view',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewComponent implements AfterViewInit {

    @Input() public ipc: ControllerPluginIPC | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngAfterViewInit() {
        // Already here IPC is available
        this.ipc.subscribeToHost((message: string) => {
            // Do something;
        });
    }

}

```

API of ControllerPluginIPC
| Name | Interface | Description |
| --- | --- | --- |
| sentToHost | **sentToHost**(message: any): Promise\<void\> | Sends message to plugin host (node part). Resolved on success of sending. |
| requestToHost | **requestToHost**(message: any): Promise\<any\> | Sends request to plugin host (node part). Resolved only within responce of plugin host. |
| subscribeToHost | **subscribeToHost**(handler: Tools.THandler): Promise\<Subscription\> | Subscribe to any income message / event from plugin host (node part). Resolved with instance of **Subscription** to have a way to unsubscribe. |

> **Note**. Plugin render process and plugin host proces (node) doesn't have direct communications channel. All messages comes to main render process, after (via main IPC) to electron process, electron process redirect it to plugin via plugin IPC. 

