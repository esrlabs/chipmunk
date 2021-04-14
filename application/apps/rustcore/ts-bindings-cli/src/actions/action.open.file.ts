import { Action } from './action';
import { RustSessionDebug } from '../../../ts-bindings/src/native/native.session';
import { EventProvider } from '../../../ts-bindings/src/api/session.provider';
import { IGrabbedElement } from '../../../ts-bindings/src/interfaces/index';
import { IGeneralError } from '../../../ts-bindings/src/interfaces/errors';

import uuid from '../../../ts-bindings/src/util/uuid';

import * as path from 'path';
import * as fs from 'fs';

const KEYS: string[] = [`--grab`, `-g`];
const ENOENT: string = 'ENOENT';

export class OpenFile extends Action {

    private _args: {
        start: number;
        end: number;
    } = {
        start: -1,
        end: -1,
    };

    public name(): string {
        return `Open given file(s)`;
    }

    public key(): string[] {
        return KEYS;
    }

    public pattern(): string {
        return `${KEYS[0]} filename`
    }

    public valid(args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const files: string[] | undefined | Error = this._getFiles(args);
            if (files instanceof Error) {
                return reject(files);
            }
            if (files === undefined) {
                return resolve();
            }
            const errors: string[] = [];
            Promise.all(files.map((filename) => {
                return new Promise((rej, res) => {
                    fs.access(filename, fs.constants.F_OK, (err: NodeJS.ErrnoException | null) => {
                        if (err) {
                            if (err.code === ENOENT) {
                                return rej(new Error(`File doesn't exist`));
                            } else {
                                return rej(err);
                            }
                        } else {
                            res();
                        }
                    });
                }).catch((err: Error) => {
                    errors.push(err.message);    
                });
            })).then(() => {
                if (errors.length > 0) {
                    return reject(new Error(errors.join('/n')));
                }
                resolve();
            }).catch(reject);
        });
    }

    public proceed(args: string[]): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const files: string[] | undefined | Error = this._getFiles(args);
            if (files instanceof Error) {
                return reject(files);
            }
            if (files === undefined) {
                return resolve(args);
            }
            Promise.all(files.map((filename: string) => {
                return new Promise<void>((done, fail) => {
                    const suuid: string = uuid();
                    const provider = new EventProvider(suuid);
                    // Set provider into debug mode
                    provider.debug().setStoring(true);
                    provider.debug().setTracking(true);
                    const session = new RustSessionDebug(suuid, provider.getEmitter());
                    const operation: string | IGeneralError = session.assign(filename, {});
                    if (typeof operation !== 'string') {
                        session.destroy();
                        return fail(new Error(`Expecting get ID of operation, but has been gotten: ${operation}`))
                    }
                    const grabbed: IGrabbedElement[] | IGeneralError = session.grabStreamChunk(500, 7);
                    if (!(grabbed instanceof Array)) {
                        session.destroy();
                        return fail(new Error(`Fail to grab data due error: ${grabbed.message}`));
                    }
                    if (provider.debug().stat.unsupported().length !== 0) {
                        session.destroy();
                        return fail(new Error(`Unsupported events:\n\t- ${provider.debug().stat.unsupported().join('\n\t- ')}`));
                    }
                    if (provider.debug().stat.error().length !== 0) {
                        session.destroy();
                        return fail(new Error(`Errors:\n\t- ${provider.debug().stat.error().join('\n\t- ')}`));
                    }
                    grabbed.forEach((item) => {
                        console.log(item.content);
                    });
                    done();
                });
            })).then(() => {
                resolve(args.filter((arg, i) => {
                    if (i < this._args.start || i > this._args.end) {
                        return true;
                    } else {
                        return false;
                    }
                }));
            }).catch(reject);
        });
    }

    private _getFiles(args: string[]): string[] | undefined | Error {
        const index: number = (() => {
            let i: number = -1;
            KEYS.forEach((key: string) => {
                if (i === -1) {
                    i = args.indexOf(key);
                }
            });
            return i;
        })();
        if (index === -1) {
            return undefined;
        }
        if (index === args.length - 1) {
            return new Error(`No filename provided`);
        }
        const files: string[] = [];
        let end: number = -1;
        for (let i = index + 1; i < args.length; i += 1) {
            if (args[i].indexOf('-') !== 0) {
                if (args[i].indexOf('.') === 0) {
                    files.push(path.normalize(path.resolve(process.cwd(), args[i])));
                } else {
                    files.push(path.normalize(args[i]));
                }
            } else {
                end = i - 1;
                break;
            }
        }
        if (files.length === 0) {
            return new Error(`No filename provided`);
        } else {
            this._args = {
                start: index + 1,
                end: end,
            };
        }
        return files;
    }

}

export default new OpenFile();
