import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Logger from '../../tools/env.logger';
import { Subscription } from '../../tools/index';
import ServiceElectron, { IPCMessages } from '../service.electron';
import ServiceStorage, { IStorageScheme } from '../service.storage';
import { IService } from '../../interfaces/interface.service';

export const MAX_NUMBER_OF_RECENT_FILES = 150;

export class ServiceFileRecent implements IService {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger = new Logger('ServiceFileRecent');

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FilesRecentRequest, this._ipc_FilesRecentRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.FilesRecentRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to "FilterRecentRequest" due error: ${error.message}.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.FiltersFilesRecentRequest, this._ipc_onFiltersRecentRequested.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.FiltersFilesRecentRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "FiltersFilesRecentRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.FiltersFilesRecentResetRequest, this._ipc_onFiltersFilesRecentResetRequested.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.FiltersFilesRecentResetRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "FiltersFilesRecentResetRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.SearchRecentRequest, this._ipc_onSearchRecentRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SearchRecentRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SearchRecentRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.SearchRecentClearRequest, this._ipc_onSearchRecentClearRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SearchRecentClearRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SearchRecentClearRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.SearchRecentAddRequest, this._ipc_onSearchRecentAddRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SearchRecentAddRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "SearchRecentAddRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceFileRecent';
    }

    public save(file: string, size: number) {
        const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
        const files: IStorageScheme.IRecentFile[] = stored.recentFiles.filter((fileInfo: IStorageScheme.IRecentFile) => {
            return fileInfo.file !== file;
        });
        if (files.length > MAX_NUMBER_OF_RECENT_FILES) {
            files.splice(files.length - 1, 1);
        }
        files.unshift({
            file: file,
            filename: path.basename(file),
            folder: path.dirname(file),
            timestamp: Date.now(),
            size: size,
        });
        ServiceStorage.get().set({
            recentFiles: files,
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        ServiceElectron.updateMenu();
    }

    public saveFilters(file: string, count: number) {
        const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
        const files: IStorageScheme.IRecentFilterFile[] = stored.recentFiltersFiles.filter((fileInfo: IStorageScheme.IRecentFilterFile) => {
            return fileInfo.file !== file;
        });
        if (files.length > MAX_NUMBER_OF_RECENT_FILES) {
            files.splice(files.length - 1, 1);
        }
        files.unshift({
            file: file,
            filename: path.basename(file),
            folder: path.dirname(file),
            timestamp: Date.now(),
            count: count,
        });
        ServiceStorage.get().set({
            recentFiltersFiles: files,
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        ServiceElectron.updateMenu();
    }

    public get(): Promise<IStorageScheme.IRecentFile[]> {
        return new Promise((resolve, reject) => {
            const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
            const checked: IStorageScheme.IRecentFile[] = [];
            Promise.all(stored.recentFiles.map((file: IStorageScheme.IRecentFile) => {
                return new Promise((resolveFile) => {
                    fs.stat(file.file, (err: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                        if (err) {
                            return resolveFile([]);
                        }
                        file.size = stats.size;
                        checked.push(file);
                        resolveFile([]);
                    });
                });
            })).then(() => {
                if (checked.length === stored.recentFiles.length) {
                    return resolve(checked);
                }
                ServiceStorage.get().set({
                    recentFiles: checked,
                }).then(() => {
                    ServiceElectron.updateMenu();
                    resolve(checked);
                }).catch((err: Error) => {
                    this._logger.error(err.message);
                });
            }).catch((error: Error) => {
                reject(new Error(`Fail to get recent file list due to error: ${error.message}`));
            });
        });
    }

    public clear() {
        ServiceStorage.get().set({
            recentFiles: [],
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        ServiceElectron.updateMenu();
    }

    private _ipc_FilesRecentRequest(request: IPCMessages.TMessage, response: (instance: IPCMessages.TMessage) => any) {
        this.get().then((files: IStorageScheme.IRecentFile[]) => {
            files.sort((a: IStorageScheme.IRecentFile, b: IStorageScheme.IRecentFile) => {
                return a.timestamp < b.timestamp ? 1 : -1;
            });
            response(new IPCMessages.FilesRecentResponse({
                files: files,
            }));
        }).catch((error: Error) => {
            this._logger.warn(error.message);
        });
    }

    private _validate(): Promise<IStorageScheme.IRecentFilterFile[]> {
        return new Promise((resolve, reject) => {
            const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
            const files: IStorageScheme.IRecentFilterFile[] = [];
            Promise.all(stored.recentFiltersFiles.map((file: IStorageScheme.IRecentFilterFile) => {
                return new Promise((resolveFile) => {
                    fs.access(file.file, fs.constants.F_OK, (err) => {
                        if (err) {
                            return resolveFile([]);
                        }
                        files.push(file);
                        resolveFile([]);
                    });
                });
            })).then(() => {
                if (files.length === stored.recentFiltersFiles.length) {
                    return resolve(files);
                }
                ServiceStorage.get().set({
                    recentFiltersFiles: files,
                }).then(() => {
                    ServiceElectron.updateMenu();
                    resolve(files);
                }).catch((err: Error) => {
                    this._logger.error(err.message);
                });
            }).catch((error: Error) => {
                reject(new Error(`Fail to validate recnt files due to error: ${error.message}`));
            });
        });
    }

    private _ipc_onFiltersRecentRequested(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        this._validate().then((files: IStorageScheme.IRecentFilterFile[]) => {
            files.sort((a: IStorageScheme.IRecentFilterFile, b: IStorageScheme.IRecentFilterFile) => {
                return a.timestamp < b.timestamp ? 1 : -1;
            });
            response(new IPCMessages.FiltersFilesRecentResponse({
                files: files,
            }));
        }).catch((error: Error) => {
            this._logger.warn(error.message);
        });
    }

    private _ipc_onFiltersFilesRecentResetRequested(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        ServiceStorage.get().set({
            recentFiltersFiles: [],
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        response(new IPCMessages.FiltersFilesRecentResetResponse({ }));
    }

    private _ipc_onSearchRecentRequest(_message: IPCMessages.TMessage, response: (isntance: IPCMessages.TMessage) => any) {
        const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
        response(new IPCMessages.SearchRecentResponse({
            requests: stored.recentSearchRequests,
        }));
    }

    private _ipc_onSearchRecentClearRequest(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        ServiceStorage.get().set({
            recentSearchRequests: [],
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        response(new IPCMessages.SearchRecentClearResponse({ }));
    }

    private _ipc_onSearchRecentAddRequest(_message: IPCMessages.TMessage, response: (isntance: IPCMessages.TMessage) => any) {
        const message: IPCMessages.SearchRecentAddRequest = _message as IPCMessages.SearchRecentAddRequest;
        if (typeof message.request !== 'string' || message.request.trim() === '') {
            response(new IPCMessages.SearchRecentAddResponse({
                error: `Search request isn't correct. It should be not empty string.`,
            }));
            return;
        }
        let stored: IStorageScheme.IRecentSearchRequest[] = ServiceStorage.get().get().recentSearchRequests;
        let updated: IStorageScheme.IRecentSearchRequest | undefined;
        // Update usage of filter
        stored = stored.filter((recent: IStorageScheme.IRecentSearchRequest) => {
            if (recent.request === message.request) {
                recent.used += 1;
                updated = recent;
                return false;
            }
            return true;
        });
        if (updated === undefined) {
            updated = {
                request: message.request,
                used: 0,
            };
        }
        stored.unshift(updated);
        ServiceStorage.get().set({
            recentSearchRequests: stored,
        }).catch((err: Error) => {
            this._logger.error(err.message);
        });
        response(new IPCMessages.SearchRecentAddResponse({ }));
    }
}

export default (new ServiceFileRecent());
