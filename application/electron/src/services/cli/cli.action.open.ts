import * as path from 'path';

import ServiceElectron from '../service.electron';
import Logger from '../../tools/env.logger';
import ServiceFileOpener, { IFilesList } from '../files/service.file.opener';

import { CLIAction, TAction } from './cli.action';
import { exist } from '../../tools/fs';
import { IPCMessages } from '../service.electron';
import { sequences } from '../../tools/sequences';

enum EMode {
    merge = 'merge',
    concat = 'concat',
}

export class OpenFiles extends CLIAction {

    private _logger: Logger = new Logger('CLIAction:: OpenFiles');
    private _mode: EMode | undefined = undefined;

    public getTask(pwd: string, args: string[]): Promise<TAction | undefined> {
        return new Promise((resolve, reject) => {
            let foundKey: boolean = false;
            const files: string[] = args.map((arg: string) => {
                if (arg === '--merge') {
                    this._mode = EMode.merge;
                    return '';
                }
                if (arg === '--concat') {
                    this._mode = EMode.concat;
                    return '';
                }
                if (arg.indexOf('-') === 0) {
                    foundKey = true;
                }
                if (foundKey) {
                    return '';
                } else {
                    return path.resolve(pwd, arg);
                }
            }).filter(arg => arg.trim() !== '');
            if (files.length === 0) {
                return resolve(undefined);
            }
            Promise.all(files.map((file: string) => {
                return exist(file);
            })).then((results: boolean[]) => {
                const confirmed: string[] = results.map((res: boolean, index: number) => {
                    return res ? files[index] : '';
                }).filter(f => f.trim() !== '');
                if (confirmed.length === 0) {
                    return resolve(undefined);
                }
                resolve(this.action.bind(this, confirmed));
            }).catch(reject);
        });
    }

    public clear(args: string[]): string[] {
        const index = args.findIndex(arg => arg.indexOf('-') === 0);
        return index === -1 ? [] : args.slice(index, args.length);
    }

    private action(files: string[]): Promise<void> {
        return new Promise((resolve) => {
            if (this._mode === EMode.merge || this._mode === EMode.concat) {
                this._mode = undefined;
                ServiceFileOpener.getListFiles(files).then((response: IFilesList) => {
                    if (response.error) {
                        this._logger.error(`Fail to create list of files due error: ${response.error}`);
                    } else {
                        ServiceElectron.IPC.send(new IPCMessages.Multiplefiles(response.files)).catch((sendingError: Error) => {
                            this._logger.error(`Fail to send "IPCMessages.Multiplefiles" message to host due error: ${sendingError.message}`);
                        });
                    }
                });
            } else {
                sequences(files.map((file: string) => {
                    return () => {
                        return new Promise((done) => {
                            ServiceElectron.IPC.request(new IPCMessages.CLIActionOpenFileRequest({
                                file: file,
                            }), IPCMessages.CLIActionOpenFileResponse).then((response: IPCMessages.CLIActionOpenFileResponse) => {
                                if (typeof response.error === 'string' && response.error.trim() !== '') {
                                    this._logger.warn(`Fail to open file due error: ${response.error}`);
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
           }
        });
    }

}
