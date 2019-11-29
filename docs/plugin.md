# Plugin structure
## Common description
Each plugin could include:
- [*optional*] back-end part (electron level)
- [*required*] front-end part (browser level, mean electron-render level)

> **Note** Plugin can skip a back-end part, but never - a front-end.

| Technology / Platform / API | Back-end Part | Front-end Part |
| ----- | --- | --- |
| **NodeJS** Using of full all features and posobilities on NodeJS | + |  |
| **npm** Posibility create npm project with dependencies | + | + |
| **JavaScript** Possibility to use pure JavaScript | + | + |
| **TypeScript** TypeScript as recommended language |  | + |

To better understand diffrence between back-end and front-end part of plugin, let's see how it cann be used. 

For example, back-end part of plugin will be needed:
- to have access to OS API, for example to file system.
- to create network connections
- to store data on disk
- and so on

Front-end part of plugin would be useful:
- to add new tab on sidebar in app
- to add new parser of data
- to add taskbar mini-application
- and so on

## Folder structure

Any plugin should have a folder's structure like present below.

For plugin, which has both parts (and back-end and front-end):
```
./plugin_folder
├── process
│   ├── [any developer files or folder]
│   └── package.json
└── render
    ├── [any developer files or folder]
    └── package.json
```

For plugin, which has only front-end part:
```
./plugin_folder
└── render
    ├── [any developer files or folder]
    └── package.json
```
# Front-end part of plugin
## None-Angular and Angular plugins
Bellow you can see a list or requirements for each type of plugin.

| Requirement | None-Angular | Angular |
| --- | - | - |
|TypeScript| optional | required |
|Angular| no | required |

List or features (use-cases) for each type of plugin.

| Feature | None-Angular | Angular |
| --- | - | - |
|Modify content in output| yes | yes |
|Change output render| no | yes |
|Change styles| no | yes |
|Add own tab into sidebar| no | yes |
|Add own tab into secondary area| no | yes |
|Add own app into taskbar| no | yes |
|Add injection into main output| no | yes |

## Mast have: chipmunk.client.toolkit
`chipmunk.client.toolkit` npm library, which includes interfaces and classes for developing any kind of front-end plugin.

Installation
```
npm install chipmunk.client.toolkit --save
```
> **Note** Bellow we will use a reference to chipmunk.client.toolkit library as `Toolkit`. It's equivalent to: `import * as Toolkit from 'chipmunk.client.toolkit';`

<h2 id="fe-none-angular-emprty-project"></h2>

## [None-Angular] Empty front-end plugin project
Step 1. Create folders
```
mkdir myplugin
cd myplugin
mkdir render
```
Step 2. Init project and install chipmunk.client.toolkit
```
cd myplugin/render
npm init
npm install chipmunk.client.toolkit --save
```
As result we should have
```
./myplugin
└── render
    ├── node_modules
    └── package.json
```

Step 3. [*Optional*] Install TypeScript

We are recommending use TypeScript, becuse it allows automatically resolve many typos and typical JavaScript errors. Install it globally, if you still don't have it.

```
npm install -g typescript
```

Step 4. [*Optional*] TypeScript  settings

Add configuration file into project
```
./myplugin
└── render
    ├── node_modules
    ├── tsconfig.json
    └── package.json
```

Example of settings (tsconfig.json)

```
{
  "compilerOptions": {
    "declaration":true,
    "outDir": "./dist/",
    "sourceMap": true,
    "noImplicitAny": true,
    "module": "commonjs",
    "target": "es6",
    "experimentalDecorators": true,
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "*": [
          "./node_modules/*"
      ]
    }
  },
  "files": [
    "./src/index.ts"
  ]
}
```
Step 5. [*Optional*] Create index file
```
mkdir src
touch index.ts
```

As results
```
./myplugin
└── render
    ├── node_modules
    ├── src
    │   └── index.ts
    ├── tsconfig.json
    └── package.json
```
Empty project is ready.

## Modification of output in the main view

Chipmunk supports a few ways to modify the main output.

| Abstract Class | Description | Usage |
|--|-----|-----|
| Toolkit.ARowBoundParser | Allows creating row parser, which will bound with plugin's host. It means: this row parser will be applied only to data, which was received from plugin's host. It also means: usage of this kind of plugin makes sense only if the plugin has a host part (back-end part), which delivery some data.<br/>A good example would be a serial port plugin. Host part extracts data from a serial port and sends it into a stream; render (this kind of plugin) applies only to data, which were gotten from a serial port. | - decoding stream output content;<br/>- converting stream output into human-readable format |
| Toolkit.ARowCommonParser | Allows creating row parser, which will be applied to each new line in stream. | - decoding stream output content;<br/>- converting stream output into human-readable format |
| Toolkit.ARowTypedParser | Allows creating row parser with checking the type of source before. It means this parser could be bound with some specific type of source, for example with some specific file's type (DLT, log and so on) | - decoding stream output content;<br/>- converting stream output into human-readable format |
| Toolkit.ASelectionParser | Allows creating parser of selection. Name of parser will be shown in the context menu of the selection. If user selects parser, parser will be applyed to selection and result will be shown on tab "Details" | - decoding selected content;<br/>- converting selected content into human-readable format |

Let's create common parser. This parser will be applied to each line in stream.

Step 1. Create empty project ([here](#fe-none-angular-emprty-project))

Step 2. 