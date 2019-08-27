import * as rimraf from 'rimraf';
import * as tar from 'tar';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { log } from './logger';

export class ControllerReplace {

    private _app: string;
    private _tgz: string;

    constructor(app: string, tgz: string) {
        this._app = app;
        this._tgz = tgz;
    }

    public replace(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Remove app folder
            log(`Starting replacing...`);
            this._remove().then(() => {
                log(`\t- removing: OK`);
                const cwd: string = path.dirname(this._app);
                // Unpack
                tar.x({
                    strict: true,
                    file: this._tgz,
                    cwd: cwd,
                }).then(() => {
                    log(`\t- tar: OK`);
                    // Remove tgz
                    fs.unlink(this._tgz, (errorTgzRm: NodeJS.ErrnoException | null) => {
                        if (errorTgzRm) {
                            log(`\t- remove tgz: FAIL:: ${errorTgzRm.message}`);
                            return reject(errorTgzRm);
                        }
                        log(`\t- remove tgz: OK`);
                        if (os.platform() === 'darwin') {
                            log(`Replacing is done...`);
                            // Do not need rename any on macos
                            return resolve();
                        }
                        // Rename folder
                        const name: string = path.basename(this._tgz).replace(/\.tgz$/gi, '');
                        fs.rename(path.resolve(cwd, name), this._app, (errorRename: NodeJS.ErrnoException | null) => {
                            if (errorRename) {
                                log(`\t- rename: FAIL:: ${errorRename.message}`);
                                return reject(errorRename);
                            }
                            log(`\t- rename: OK`);
                            log(`Replacing is done...`);
                            resolve();
                        });
                    });
                }).catch((errorTar: Error) => {
                    log(`\t- tar: FAIL:: ${errorTar.message}`);
                    reject(errorTar);
                });
            }).catch((errorRemovingCurrent: Error) => {
                log(`\t- removing: FAIL:: ${errorRemovingCurrent.message}`);
                reject(errorRemovingCurrent);
            });
        });
    }

    private _remove(): Promise<void> {
        return new Promise((resolve, reject) => {
            rimraf(os.platform() === 'darwin' ? this._app : path.dirname(this._app), (error: Error | null | undefined) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

}
