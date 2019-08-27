import * as os from 'os';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { ControllerArguments } from './controller.args';
import { ControllerReplace } from './controller.replace';
import { log } from './logger';

class Updater {

    private _paths: {
        app: string,
        tgz: string,
    } = {
        app: '',
        tgz: '',
    };

    constructor() {
        log(`Updater is started at ${(new Date()).toISOString()}`);
        const args: ControllerArguments = new ControllerArguments();
        const app = args.getApp();
        const tgz = args.getTgz();
        if (app === undefined || tgz === undefined) {
            return;
        }
        this._paths = {
            app: app,
            tgz: tgz,
        };
        this._proceed();
    }

    private _proceed() {
        const replace: ControllerReplace = new ControllerReplace(this._paths.app, this._paths.tgz);
        replace.replace().then(() => {
            log(`App is replaced.`);
            // Execute
            const target: string = this._getAppStartFile(this._paths.app);
            log(`Executing: ${target}`);
            const app: ChildProcess = spawn(target, {
                detached: true,
                stdio: 'ignore',
            });
            app.unref();
            log(`All done. Exit.`);
            process.exit(0);
        }).catch((replaceError: Error) => {
            log(`Replacing is failed due error: ${replaceError.message}`);
            process.stderr.write(`Replace failed due error: ${replaceError.message}`);
        });
    }

    private _getAppStartFile(dest: string): string {
        switch (os.platform()) {
            case 'darwin':
                return path.resolve(dest, 'Contents/MacOS/chipmunk');
            case 'win32':
                return dest;
            default:
                return dest;
        }
    }

}

// Let chipmunk closes
setTimeout(() => {
    new Updater();
}, 1000);
