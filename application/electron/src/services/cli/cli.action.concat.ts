import * as path from 'path';
import * as glob from 'glob';

import ServiceElectron from '../service.electron';
import Logger from '../../tools/env.logger';

import { CLIAction, TAction } from './cli.action';
import { exist } from '../../tools/fs';
import { IPCMessages } from '../service.electron';
import { sequences } from '../../tools/sequences';

export class ConcatFiles extends CLIAction {

    static KEYS: string[] = ['-c', '--concat'];

    private _logger: Logger = new Logger('CLIAction:: ConcatFiles');

    public getTask(pwd: string, args: string[]): Promise<TAction | undefined> {
        const self = this;
        function verify(files: string[]): Promise<string[]> {
            return new Promise((res, reject) => {
                const patterns: string[] = [];
                files = files.filter((file: string) => {
                    if (file.search(/[\?\^\!\+@]/gi) === 0 || file.indexOf('*') !== -1) {
                        patterns.push(file);
                        return false;
                    } else {
                        return true;
                    }
                });
                Promise.all(patterns.map((pattern: string) => {
                    return new Promise((resolvePattern) => {
                        glob(pattern, { cwd: pwd }, (err: Error | null, matches: string[]) => {
                            if (err) {
                                self._logger.warn(`Fail apply pattern "${pattern}" due error: ${err.message}`);
                            } else if (matches.length > 0) {
                                files = files.concat(matches);
                            }
                            resolvePattern(undefined);
                        });
                    });
                })).then(() => {
                    Promise.all(files.map((file: string) => {
                        return exist(file);
                    })).then((results: boolean[]) => {
                        const confirmed: string[] = results.map((v: boolean, index: number) => {
                            return v ? files[index] : '';
                        }).filter(f => f.trim() !== '');
                        res(confirmed);
                    }).catch(reject);
                });
            });
        }
        return new Promise((resolve, reject) => {
            const groups: string[][] = [];
            let group: string[] = [];
            this._filter(args, true).forEach((arg: string, i: number, arr) => {
                if (ConcatFiles.KEYS.indexOf(arg) !== -1 || i === arr.length - 1) {
                    if (group.length > 0) {
                        groups.push(group);
                    }
                }
                if (ConcatFiles.KEYS.indexOf(arg) !== -1) {
                    group = [];
                } else {
                    group.push(path.resolve(pwd, arg));
                    if (i === arr.length - 1) {
                        groups.push(group);
                    }
                }
            });
            const confirmed: string[][] = [];
            Promise.all(groups.map((g: string[]) => {
                return verify(g).then((files: string[]) => {
                    if (files.length > 0) {
                        confirmed.push(files);
                    }
                }).catch((err: Error) => {
                    this._logger.debug(`Fail to verify file list due error: ${err.message}`);
                });
            })).then(() => {
                if (confirmed.length === 0) {
                    return resolve(undefined);
                }
                resolve(this.action.bind(this, confirmed));
            }).catch(reject);
        });
    }

    public clear(args: string[]): string[] {
        return this._filter(args, false);
    }

    private action(groups: string[][]): Promise<void> {
        return new Promise((resolve) => {
            sequences(groups.map((files: string[]) => {
                return () => {
                    return new Promise((done) => {
                        ServiceElectron.IPC.request(new IPCMessages.CLIActionConcatFilesRequest({
                            files: files,
                        }), IPCMessages.CLIActionConcatFilesResponse).then((response: IPCMessages.CLIActionConcatFilesResponse) => {
                            if (typeof response.error === 'string' && response.error.trim() !== '') {
                                this._logger.warn(`Fail to merge files due error: ${response.error}`);
                            }
                        }).catch((err: Error) => {
                            this._logger.error(err.message);
                        }).finally(() => {
                            done(undefined);
                        });
                    });
                };
            }), false).catch((err: Error) => {
                this._logger.warn(`Error during applying actions: ${err.message}`);
            }).finally(resolve);
        });
    }

    private _filter(args: string[], merge: boolean): string[] {
        let open: boolean = false;
        return args.filter((arg: string) => {
            if (ConcatFiles.KEYS.indexOf(arg) !== -1) {
                open = true;
                return merge;
            }
            if (!open) {
                return !merge;
            }
            if (arg.indexOf('-') === 0) {
                open = false;
                return !merge;
            } else {
                return merge;
            }
        });
    }


}
