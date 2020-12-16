import { Subscription, Subject, Observable } from 'rxjs';
import { IPCMessages } from '../services/service.electron.ipc';
import { Session } from './session/session';
import { CommonInterfaces} from '../interfaces/interface.common';
import { CancelablePromise } from 'chipmunk.client.toolkit';

import SessionsService from '../services/service.sessions.tabs';
import EventsHubService from '../services/standalone/service.eventshub';
import ElectronIpcService from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';
import * as moment from 'moment';

export interface IFile {
    lastModified: number;
    lastModifiedDate: Date;
    name: string;
    path: string;
    size: number;
    type: string;
}

export interface IConcatFile {
    parser: string;
    path: string;
    name: string;
    size: number;
    created: number;
    changed: number;
    createdStr: string;
    changedStr: string;
    selected: boolean;
    request: string;
    matches: number;
}

export class ControllerFileConcatSession {

    private _logger: Toolkit.Logger;
    private _session: string;
    private _tasks: Map<string, CancelablePromise<any, any, any, any>> = new Map();
    private _files: Map<string, IConcatFile> = new Map();
    private _regexpstr: string = '';
    private _subjects: {
        FileUpdated: Subject<IConcatFile>,
        FilesUpdated: Subject<IConcatFile[]>,
    } = {
        FileUpdated: new Subject<IConcatFile>(),
        FilesUpdated: new Subject<IConcatFile[]>(),
    };

    constructor(session: string) {
        this._session = session;
        this._logger = new Toolkit.Logger(`ControllerFileConcatSession: ${session}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._tasks.size === 0) {
                this._logger.debug(`No active tasks; no need to abort any.`);
                return resolve();
            }
            Promise.all(Array.from(this._tasks.values()).map((task: CancelablePromise<any, any, any, any>) => {
                return new Promise((resolveTask) => {
                    task.canceled(resolveTask);
                    task.abort('Controller is going to be destroyed');
                });
            })).then(() => {
                resolve();
                this._logger.debug(`All tasks are aborted; controller is destroyed.`);
            }).catch((err: Error) => {
                this._logger.error(`Unexpected error during destroying: ${err.message}`);
                reject(err);
            });
        });
    }

    public getFiles(): IConcatFile[] {
        return Array.from(this._files.values());
    }

    public getGuid(): string {
        return this._session;
    }

    public getObservable(): {
        FileUpdated: Observable<IConcatFile>,
        FilesUpdated: Observable<IConcatFile[]>,
    } {
        return {
            FileUpdated: this._subjects.FileUpdated.asObservable(),
            FilesUpdated: this._subjects.FilesUpdated.asObservable(),
        };
    }

    public add(files: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(files.map((file: string) => {
                return new Promise((next) => {
                    this._addFileByPath(file).then(() => {
                        this._subjects.FileUpdated.next(this._files.get(file));
                        this._subjects.FilesUpdated.next(Array.from(this._files.values()));
                        next();
                    }).catch((fileErr: Error) => {
                        this._logger.warn(`Fail to get file info for "${file}" due error: ${fileErr.message}`);
                        next();
                    });
                });
            })).then(() => {
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to get file info due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public remove(path: string) {
        this._files.delete(path);
        this._subjects.FilesUpdated.next(Array.from(this._files.values()));
    }

    public update(path: string, file: IConcatFile): boolean {
        if (!this._files.has(path)) {
            return false;
        }
        this._files.set(path, file);
        this._subjects.FileUpdated.next(file);
        return true;
    }

    public set(files: IConcatFile[]) {
        this._files.clear();
        files.forEach((file: IConcatFile) => {
            this._files.set(file.path, file);
        });
        this._subjects.FilesUpdated.next(files);
        return true;
    }

    public getRegExpStr(): string {
        return this._regexpstr;
    }

    public drop() {
        this._files.clear();
        this._regexpstr = '';
        this._subjects.FilesUpdated.next([]);
    }

    public concat(): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise<void>((resolve, reject) => {
            /*
            EventsHubService.getSubject().onKeepScrollPrevent.next();
            ElectronIpcService.request(new IPCMessages.ConcatFilesRequest({
                files: Array.from(this._files.values()).map((file: IConcatFile) => {
                    return {
                        parser: file.parser,
                        file: file.path,
                    };
                }),
                id: Toolkit.guid(),
                session: this._session,
            }), IPCMessages.ConcatFilesResponse).then((response: IPCMessages.ConcatFilesResponse) => {
                if (typeof response.error === 'string' && response.error.trim() !== '') {
                    this._logger.error(`Concat operation was failed due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((concatErr: Error) => {
                this._logger.error(`Fail to do concat due error: ${concatErr.message}`);
                reject(concatErr);
            });
            */
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public search(regexpstr: string): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise<void>((resolve, reject) => {
            if (regexpstr.trim() === '') {
                return;
            }
            if (!Toolkit.regTools.isRegStrValid(regexpstr)) {
                return;
            }
            ElectronIpcService.request(new IPCMessages.FilesSearchRequest({
                files: Array.from(this._files.values()).map((file: IConcatFile) => {
                    return file.path;
                }),
                requests: [
                    { source: regexpstr, flags: 'gi'}
                ],
            }), IPCMessages.FilesSearchResponse).then((response: IPCMessages.FilesSearchResponse) => {
                if (typeof response.error === 'string' && response.error.trim() !== '') {
                    this._logger.warn(`Fail to search files due error: ${response.error}`);
                    return reject(new Error(`Fail to search files due error: ${response.error}`));
                }
                if (typeof response.matches !== 'object' || response.matches === null) {
                    this._regexpstr = '';
                } else {
                    this._regexpstr = regexpstr;
                    this._files.forEach((file: IConcatFile, key: string) => {
                        if (response.matches[file.path] === undefined) {
                            file.matches = 0;
                            file.request = '';
                        } else {
                            file.matches = response.matches[file.path];
                            file.request = regexpstr;
                        }
                        this._files.set(key, file);
                        this._subjects.FileUpdated.next(file);
                    });
                    this._subjects.FilesUpdated.next(Array.from(this._files.values()));
                }
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to search files due error: ${error.message}`);
                reject(error);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    private _addFileByPath(path: string): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise((resolve, reject) => {
            if (this._files.has(path)) {
                return resolve();
            }
            /*
            this._getFileStats(path).then((stats: IPCMessages.FileInfoResponse) => {
                this._files.set(path, {
                    path: stats.path,
                    name: stats.name,
                    parser: stats.parser,
                    size: stats.size,
                    created: stats.created,
                    changed: stats.changed,
                    createdStr: moment(stats.created).format('DD/MM/YYYY hh:mm:ss.s'),
                    changedStr: moment(stats.changed).format('DD/MM/YYYY hh:mm:ss.s'),
                    selected: false,
                    matches: 0,
                    request: ''
                });
                resolve();
            }).catch((parserError: Error) => {
                reject(new Error(`Fail detect file parser due error: ${parserError.message}`));
            });
            */
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    private _getFileStats(file: string): CancelablePromise<IPCMessages.FileInfoResponse> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.FileInfoResponse> = new CancelablePromise<IPCMessages.FileInfoResponse>((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FileInfoRequest({
                file: file,
            }), IPCMessages.FileInfoResponse).then((stats: IPCMessages.FileInfoResponse) => {
                /*
                if (stats.parser === undefined) {
                    return reject(new Error('Fail to find parser for selected file.'));
                }
                */
                resolve(stats);
            }).catch((error: Error) => {
                reject(error);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

}
