/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Use to start test ./node_modules/.bin/jasmine-ts src/something.spec.ts

import * as Path from 'path';
import * as Common from '../platform/node/src/index';
import * as Installer from '../src/index';

const MODULE_PATH: string = Common.Env.getExecutedModulePath();
const SOURCE_TS_NODE_APP: string = Path.resolve(MODULE_PATH, '../../../../../sandbox/serialport');

const logger = new Common.Logger('[Test][TS Node App Installer]');

describe('[Test][TS Node App Installer]', () => {
    beforeEach(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
    });

    it('[Install]', (done: () => any ) => {
        const npm = new Installer.NPMInstaller();
        const tsc = new Installer.TSCCompiler();
        // Check source folder
        if (!Common.FS.isExist(SOURCE_TS_NODE_APP)) {
            fail(new Error(`Folder ${SOURCE_TS_NODE_APP}`));
            return done();
        }
        // Clear sandbox
        Promise.all([
            Common.FS.rmdir(Path.resolve(SOURCE_TS_NODE_APP, 'node_modules')),
            Common.FS.rmdir(Path.resolve(SOURCE_TS_NODE_APP, 'build')),
        ]).then(() => {
            npm.subscribe(Installer.NPMInstaller.Events.logs, (str: string) => {
                logger.info(str);
            });
            npm.install(SOURCE_TS_NODE_APP).then(() => {
                tsc.subscribe(Installer.TSCCompiler.Events.logs, (str: string) => {
                    logger.info(str);
                });
                tsc.compiler(SOURCE_TS_NODE_APP).then(() => {
                    logger.info('Installtion is complite');
                    return done();
                }).catch((error: Error) => {
                    fail(error);
                    return done();
                });
            }).catch((error: Error) => {
                fail(error);
                return done();
            });
        }).catch((error: Error) => {
            fail(error);
            return done();
        });
    });

});
