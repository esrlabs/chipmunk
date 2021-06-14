// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Manual start of defined test:
// ./node_modules/.bin/jasmine-ts src/something.spec.ts

// If you have error like next:
//
// Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './dist' is not defined by "exports" in ./application/apps/rustcore/node_modules/ts-node/package.json
//
// You have to resolve it by hands. Open "./application/apps/rustcore/node_modules/ts-node/package.json"
// Add there ("./dist": "./dist/index.js") into "exports" sections. Like this:
//
// "exports": {
//     ".": "./dist/index.js",
//     "./dist": "./dist/index.js",
//     ...
// }

// Get rid of default Jasmine timeout
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

describe('Example of test', () => {

    it('Example done', (done: Function)=> {
        done();
    });

    it('Example fail', (done: Function)=> {
        fail(`Because it's a test`);
        done();
    });

});
