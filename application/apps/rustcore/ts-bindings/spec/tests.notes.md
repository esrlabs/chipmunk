# Making TypeScript available for IDE
We need to provide path to TypeScript types definitions in each `*.spec.ts` file
```
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
```

# Manual start of defined test:
```
./node_modules/.bin/jasmine-ts src/something.spec.ts
```

# Debug
Add next configuration into `launch.json` of VSCode

```
{
    "version": "0.2.0",
    "configurations": [
        
        {
            "type": "node",
            "request": "launch",
            "name": "Jasmine Current File",
            "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
            "program": "${workspaceFolder}/node_modules/jasmine-ts/lib/index",
            "args": ["--config=${workspaceFolder}/spec/support/jasmine.json", "${file}"],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"
        }
    ]
}
```

Take in account, jasmine should be started considering embedded version of node. That's why there parameter `runtimeExecutable`

# Troubleshooting
## ts-node issue

If you have error like next:

```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './dist' is not defined by "exports" in ./application/apps/rustcore/ts/node_modules/ts-node/package.json
```

You have to resolve it by hands. 

1. Open "./application/apps/rustcore/ts/node_modules/ts-node/package.json"
2. Add there ("./dist": "./dist/index.js") into "exports" sections. Like this:

```
"exports": {
    ".": "./dist/index.js",
    "./dist": "./dist/index.js",
    ...
}
```

## Wrong version of node module
Test should be started in scope of embedded (into electron) version on node. To start test, just add next into `package.json`

```
  "scripts": {
    ...
    "test": "./node_modules/.bin/electron ./node_modules/jasmine-ts/lib/index.js"
    ...
  },
```

Make sure you have right version of electron as dependency

```
"dependencies": {
    ...
    "electron": "10.1.5"
    ...
},
```

## Jasmine timeout
To get rid of short Jasmine timeout (can be useful for testing async operation, which may take long time) just add it into `*.spec.ts` file

```
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;
```