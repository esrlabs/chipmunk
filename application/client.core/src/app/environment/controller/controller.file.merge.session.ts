import { Subscription, Subject, Observable } from 'rxjs';
import { IPCMessages } from '../services/service.electron.ipc';
import { Session } from './session/session';
import { CancelablePromise } from 'chipmunk.client.toolkit';

import SessionsService from '../services/service.sessions.tabs';
import EventsHubService from '../services/standalone/service.eventshub';
import ElectronIpcService from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IFileInfo {
    path: string;
    name: string;
    parser: string;
    preview: string;
    size: number;
}

export interface IFileOptions {
    year: number | undefined;
    offset: number | undefined;
}

export interface ITimeScale {
    min: string;
    max: string;
    sMin: number;
    sMax: number;
}

export interface ITimestampFormat {
    format: string;
    regex: string;
    flags: string[];
}

export interface IMergeFile {
    path: string;
    info?: IFileInfo;
    scale?: ITimeScale;
    format?: ITimestampFormat;
    error?: string;
    options: IFileOptions;
}

export enum EViewMode {
    min = 'min',
    max = 'max',
}

export class ControllerFileMergeSession {

    private _logger: Toolkit.Logger;
    private _session: string;
    private _tasks: Map<string, CancelablePromise<any, any, any, any>> = new Map();
    private _files: Map<string, IMergeFile> = new Map();
    private _timescale: ITimeScale = {
        max: '',
        min: '',
        sMax: 0,
        sMin: 0,
    };
    private _subjects: {
        FileUpdated: Subject<IMergeFile>,
        FilesUpdated: Subject<IMergeFile[]>,
        ScaleUpdated: Subject<ITimeScale>,
    } = {
        FileUpdated: new Subject<IMergeFile>(),
        FilesUpdated: new Subject<IMergeFile[]>(),
        ScaleUpdated: new Subject<ITimeScale>(),
    };

    constructor(session: string) {
        this._session = session;
        this._logger = new Toolkit.Logger(`ControllerFileMergeSession: ${session}`);
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

    public getFiles(): IMergeFile[] {
        return Array.from(this._files.values());
    }

    public getGuid(): string {
        return this._session;
    }

    public getObservable(): {
        FileUpdated: Observable<IMergeFile>,
        FilesUpdated: Observable<IMergeFile[]>,
        ScaleUpdated: Observable<ITimeScale>,
    } {
        return {
            FileUpdated: this._subjects.FileUpdated.asObservable(),
            FilesUpdated: this._subjects.FilesUpdated.asObservable(),
            ScaleUpdated: this._subjects.ScaleUpdated.asObservable(),
        };
    }

    public add(files: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            files.forEach((file: string) => {
                this._files.set(file, {
                    format: undefined,
                    info: undefined,
                    path: file,
                    options: {
                        offset: undefined,
                        year: undefined,
                    },
                });
            });
            this._subjects.FilesUpdated.next(Array.from(this._files.values()));
            this._discover(files).then((discoveredFiles: IPCMessages.IMergeFilesDiscoverResult[]) => {
                Promise.all(discoveredFiles.map((discoveredFile: IPCMessages.IMergeFilesDiscoverResult) => {
                    return new Promise((next) => {
                        this._getFileInfo(discoveredFile.path).then((info: IFileInfo) => {
                            // TODO: discoveredFile.format could be NULL or UNDEFINED
                            this._files.set(discoveredFile.path, {
                                format: discoveredFile.format === undefined ? undefined : {
                                    format: discoveredFile.format.format,
                                    flags: discoveredFile.format.flags,
                                    regex: discoveredFile.format.regex,
                                },
                                error: discoveredFile.error,
                                scale: this._getTimeScale(discoveredFile),
                                info: info,
                                path: discoveredFile.path,
                                options: {
                                    offset: undefined,
                                    year: undefined,
                                },
                            });
                            this._subjects.FileUpdated.next(this._files.get(discoveredFile.path));
                            this._subjects.FilesUpdated.next(Array.from(this._files.values()));
                            next(undefined);
                        }).catch((infoErr: Error) => {
                            this._logger.warn(`Fail get file information for "${discoveredFile.path}" due error: ${infoErr.message}`);
                            next(undefined);
                        });
                    });
                })).then(() => {
                    this._updateTimeScale();
                    resolve();
                }).catch((queueErr: Error) => {
                    this._logger.warn(`Fail to discover some of files due error: ${queueErr.message}`);
                    reject(queueErr);
                });
            }).catch((discoverErr: Error) => {
                this._logger.warn(`Fail to discover files due error: ${discoverErr.message}`);
                reject(discoverErr);
            });
        });
    }

    public remove(path: string) {
        this._files.delete(path);
        this._updateTimeScale();
        this._subjects.FilesUpdated.next(Array.from(this._files.values()));
    }

    public update(path: string, file: IMergeFile): boolean {
        if (!this._files.has(path)) {
            return false;
        }
        this._files.set(path, file);
        this._updateTimeScale();
        this._subjects.FileUpdated.next(file);
        return true;
    }

    public setOptions(path: string, options: IFileOptions): boolean {
        const file: IMergeFile | undefined = this._files.get(path);
        if (file === undefined) {
            return false;
        }
        file.options = options;
        this._files.set(path, file);
        this._subjects.FileUpdated.next(file);
        return true;
    }

    public drop() {
        this._files.clear();
        this._updateTimeScale();
        this._subjects.FilesUpdated.next([]);
    }

    public merge(): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise<void>((resolve, reject) => {
            const files: IPCMessages.IMergeFilesRequestFile[] = Array.from(this._files.values()).map((file: IMergeFile) => {
                return {
                    file: file.path,
                    format: file.format !== undefined ? file.format.format : '',
                    year: file.options.year,
                    parser: '',
                    offset: file.options.offset === undefined ? 0 : file.options.offset,
                    zone: '',
                };
            });
            EventsHubService.getSubject().onKeepScrollPrevent.next();
            ElectronIpcService.request(new IPCMessages.MergeFilesRequest({
                files: files,
                id: Toolkit.guid(),
                session: this._session,
            }), IPCMessages.MergeFilesResponse).then((response: IPCMessages.MergeFilesResponse) => {
                if (typeof response.error === 'string' && response.error.trim() !== '') {
                    this._logger.error(`Merge operation was failed due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((mergeErr: Error) => {
                this._logger.error(`Fail to do merge due error: ${mergeErr.message}`);
                reject(mergeErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public test(file: string, format: string): CancelablePromise<IPCMessages.IMergeFilesTestResponse> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.IMergeFilesTestResponse> = new CancelablePromise<IPCMessages.IMergeFilesTestResponse>(
            (resolve, reject, cancel, refCancelCB, self) => {
            ElectronIpcService.request(new IPCMessages.MergeFilesTestRequest({
                file: file,
                format: format,
                id: id,
            }), IPCMessages.MergeFilesTestResponse).then((response: IPCMessages.MergeFilesTestResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to test files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve(response);
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to test files due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public getTimeScale(): ITimeScale {
        return this._timescale;
    }

    public isTimeScaleValid(): boolean {
        return this._timescale.max !== '' && this._timescale.min !== '';
    }

    public validate(format): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise<void>(
            (resolve, reject, cancel, refCancelCB, self) => {
            ElectronIpcService.request(new IPCMessages.MergeFilesFormatRequest({
                format: format,
            }), IPCMessages.MergeFilesFormatResponse).then((response: IPCMessages.MergeFilesFormatResponse) => {
                if (typeof response.error === 'string') {
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to test format due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    private _discover(files: string[]): CancelablePromise<IPCMessages.IMergeFilesDiscoverResult[]> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.IMergeFilesDiscoverResult[]> = new CancelablePromise<IPCMessages.IMergeFilesDiscoverResult[]>(
            (resolve, reject, cancel, refCancelCB, self) => {
            ElectronIpcService.request(new IPCMessages.MergeFilesDiscoverRequest({
                files: files,
                id: id,
            }), IPCMessages.MergeFilesDiscoverResponse).then((response: IPCMessages.MergeFilesDiscoverResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to discover files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve(response.files);
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to discover files due error: ${disErr.message}`);
                return reject(disErr);
            });
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

    private _getFileContent(file: string, length: number = 25000): CancelablePromise<IPCMessages.FileReadResponse> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.FileReadResponse> = new CancelablePromise<IPCMessages.FileReadResponse>((resolve, reject) => {
            const session: Session | undefined = SessionsService.getActive();
            if (session === undefined) {
                return reject(new Error(`No active session found`));
            }
            ElectronIpcService.request(new IPCMessages.FileReadRequest({
                file: file,
                bytes: length,
                session: session.getGuid(),
            }), IPCMessages.FileReadResponse).then((response: IPCMessages.FileReadResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                resolve(response);
            }).catch((error: Error) => {
                reject(error);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    private _getFileInfo(path: string): CancelablePromise<IFileInfo> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IFileInfo> = new CancelablePromise<IFileInfo>((resolve, reject) => {
            /*
            this._getFileStats(path).then((stats: IPCMessages.FileInfoResponse) => {
                this._getFileContent(path).then((preview: IPCMessages.FileReadResponse) => {
                    resolve({
                        path: stats.path,
                        name: stats.name,
                        parser: stats.parser,
                        size: stats.size,
                        preview: preview.content,
                    });
                }).catch((previewError: Error) => {
                    reject(new Error(`Fail read preview of file due error: ${previewError.message}`));
                });
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

    private _getTimeScale(file: IPCMessages.IMergeFilesDiscoverResult): ITimeScale | undefined {
        function getUnixTime(smth: number | string): number | undefined {
            if (typeof smth === 'string') {
                smth = parseInt(smth, 10);
            }
            const date: Date = new Date(smth);
            if (!(date instanceof Date)) {
                return undefined;
            }
            const ts: number = date.getTime();
            if (isNaN(ts) || !isFinite(ts)) {
                return undefined;
            }
            return ts;
        }
        if (file.maxTime === undefined || file.minTime === undefined) {
            return undefined;
        }
        const sMin: number | undefined = getUnixTime(file.minTime);
        const sMax: number | undefined = getUnixTime(file.maxTime);
        if (sMin === undefined || sMax === undefined) {
            return undefined;
        }
        return {
            max: (new Date(sMax)).toISOString(),
            min: (new Date(sMin)).toISOString(),
            sMax: sMax,
            sMin: sMin,
        };
    }

    private _updateTimeScale() {
        this._timescale = { max: '', min: '', sMax: 0, sMin: Infinity, };
        this._files.forEach((file: IMergeFile) => {
            if (file.scale === undefined) {
                return;
            }
            if (file.scale.sMax > this._timescale.sMax) {
                this._timescale.sMax = file.scale.sMax;
                this._timescale.max = file.scale.max;
            }
            if (file.scale.sMin < this._timescale.sMin) {
                this._timescale.sMin = file.scale.sMin;
                this._timescale.min = file.scale.min;
            }
        });
        this._subjects.ScaleUpdated.next(this._timescale);
    }

}
