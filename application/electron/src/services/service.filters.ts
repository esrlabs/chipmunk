import Logger from '../tools/env.logger';
import { dialog, SaveDialogReturnValue, OpenDialogReturnValue } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IService } from '../interfaces/interface.service';
import ServiceElectron, { IPCMessages, Subscription } from './service.electron';
import ServiceStorage, { IStorageScheme } from '../services/service.storage';

const MAX_NUMBER_OF_RECENT_FILES = 100;

interface IStoredFileData {
    filters: IPCMessages.IFilter[];
    charts: IPCMessages.IChartSaveRequest[];
}

/**
 * @class ServiceFilters
 * @description Just keep information about filters
 */

class ServiceFilters implements IService {

    private _logger: Logger = new Logger('ServiceFilters');
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.FiltersLoadRequest, this._ipc_onFiltersLoadRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.FiltersLoadRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "FiltersLoadRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCMessages.FiltersSaveRequest, this._ipc_onFiltersSaveRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.FiltersSaveRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "FiltersSaveRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
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
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceFilters';
    }

    private _ipc_onFiltersLoadRequest(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        const request: IPCMessages.FiltersLoadRequest = message as IPCMessages.FiltersLoadRequest;
        if (request.file === undefined) {
            const win = ServiceElectron.getBrowserWindow();
            if (win === undefined) {
                return;
            }
            dialog.showOpenDialog(win, {
                properties: ['openFile', 'showHiddenFiles'],
                filters: [{ name: 'Text Files', extensions: ['txt']}],
            }).then((returnValue: OpenDialogReturnValue) => {
                if (!(returnValue.filePaths instanceof Array) || returnValue.filePaths.length !== 1) {
                    return;
                }
                const file: string = returnValue.filePaths[0];
                this._loadFile(file).then((content: IStoredFileData) => {
                    this._saveAsRecentFile(file, content.filters.length + content.charts.length);
                    response(new IPCMessages.FiltersLoadResponse({
                        filters: content.filters,
                        charts: content.charts,
                        file: file,
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.FiltersLoadResponse({
                        filters: [],
                        charts: [],
                        file: file,
                        error: this._logger.warn(`Fail to open file "${file}" due error: ${error.message}`),
                    }));
                });
            });
        } else {
            this._loadFile(request.file).then((content: IStoredFileData) => {
                this._saveAsRecentFile(request.file as string, content.filters.length + content.charts.length);
                response(new IPCMessages.FiltersLoadResponse({
                    filters: content.filters,
                    charts: content.charts,
                    file: request.file as string,
                }));
            }).catch((error: Error) => {
                return response(new IPCMessages.FiltersLoadResponse({
                    filters: [],
                    charts: [],
                    file: request.file as string,
                    error: this._logger.warn(`Fail to open file "${request.file}" due error: ${error.message}`),
                }));
            });
        }
    }

    private _ipc_onFiltersSaveRequest(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        const request: IPCMessages.FiltersSaveRequest = message as IPCMessages.FiltersSaveRequest;
        const content: string = JSON.stringify({
            filters: request.filters,
            charts: request.charts,
        });
        if (typeof request.file === 'string') {
            if (!fs.existsSync(request.file)) {
                request.file = undefined;
            }
        }
        if (typeof request.file === 'string') {
            this._saveFile(request.file, content).then(() => {
                this._saveAsRecentFile(request.file as string, request.filters.length);
                response(new IPCMessages.FiltersSaveResponse({
                    filename: request.file as string,
                }));
            }).catch((error: Error) => {
                this._logger.warn(`Error during saving filters into file "${request.file}": ${error.message}`);
                response(new IPCMessages.FiltersSaveResponse({
                    filename: request.file as string,
                    error: error.message,
                }));
            });
        } else {
            dialog.showSaveDialog({
                title: 'Saving filters',
                filters: [{ name: 'Text Files', extensions: ['txt']}],
            }).then((results: SaveDialogReturnValue) => {
                this._saveFile(results.filePath, content).then(() => {
                    this._saveAsRecentFile(results.filePath as string, request.filters.length);
                    response(new IPCMessages.FiltersSaveResponse({
                        filename: path.basename(results.filePath as string),
                    }));
                }).catch((error: Error) => {
                    this._logger.warn(`Error during saving filters into file "${results.filePath}": ${error.message}`);
                    response(new IPCMessages.FiltersSaveResponse({
                        filename: path.basename(results.filePath as string),
                        error: error.message,
                    }));
                });
            });
        }
    }

    private _ipc_onFiltersRecentRequested(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        this._validateRecentFiles().then((files: IStorageScheme.IRecentFilterFile[]) => {
            files.sort((a: IStorageScheme.IRecentFilterFile, b: IStorageScheme.IRecentFilterFile) => {
                return a.timestamp < b.timestamp ? 1 : -1;
            });
            response(new IPCMessages.FiltersFilesRecentResponse({
                files: files,
            }));
        });
    }

    private _ipc_onFiltersFilesRecentResetRequested(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        ServiceStorage.get().set({
            recentFiltersFiles: [],
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
        });
        response(new IPCMessages.SearchRecentAddResponse({ }));
    }

    private _loadFile(file: string): Promise<IStoredFileData> {
        return new Promise((resolve, reject) => {
            fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (error) {
                    return reject(error);
                }
                fs.readFile(file, (readingError: NodeJS.ErrnoException | null, data: Buffer | string) => {
                    if (readingError) {
                        return reject(readingError);
                    }
                    data = data.toString();
                    try {
                        const content: IStoredFileData = JSON.parse(data);
                        if (typeof content !== 'object' || content === null) {
                            return reject(new Error(`Fail to parse file "${file}" because content isn't an object.`));
                        }
                        if (!(content.filters instanceof Array) || !(content.charts instanceof Array)) {
                            return reject(new Error(`Fail to parse file "${file}" because "filters" or "charts" aren't an Array.`));
                        }
                        resolve(content);
                    } catch (e) {
                        return reject(new Error(`Fail to parse file "${file}" due error: ${e.message}`));
                    }
                });
            });
        });
    }

    private _saveFile(filename: string | undefined, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (filename === undefined) {
                return reject(new Error(`Not valid name of file`));
            }
            fs.writeFile(filename, content, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private _saveAsRecentFile(file: string, filters: number) {
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
            filters: filters,
        });
        ServiceStorage.get().set({
            recentFiltersFiles: files,
        });
        ServiceElectron.updateMenu();
    }

    private _validateRecentFiles(): Promise<IStorageScheme.IRecentFilterFile[]> {
        return new Promise((resolve) => {
            const stored: IStorageScheme.IStorage = ServiceStorage.get().get();
            const files: IStorageScheme.IRecentFilterFile[] = [];
            Promise.all(stored.recentFiltersFiles.map((file: IStorageScheme.IRecentFilterFile) => {
                return new Promise((resolveFile) => {
                    fs.access(file.file, fs.constants.F_OK, (err) => {
                        if (err) {
                            return resolveFile();
                        }
                        files.push(file);
                        resolveFile();
                    });
                });
            })).then(() => {
                if (files.length === stored.recentFiltersFiles.length) {
                    return resolve(files);
                }
                ServiceStorage.get().set({
                    recentFiltersFiles: files,
                });
                ServiceElectron.updateMenu();
                resolve(files);
            });
        });
    }

}

export default (new ServiceFilters());
