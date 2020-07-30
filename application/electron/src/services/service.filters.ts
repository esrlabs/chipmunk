import Logger from '../tools/env.logger';
import { dialog, SaveDialogReturnValue, OpenDialogReturnValue } from 'electron';
import * as fs from 'fs';
import { IService } from '../interfaces/interface.service';
import ServiceElectron, { IPCMessages, Subscription } from './service.electron';
import ServiceFileRecent from './files/service.file.recent';


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
                this._loadFile(file).then((content: string) => {
                    ServiceFileRecent.saveFilters(file, 0); // TODO: detect count of entities to save
                    response(new IPCMessages.FiltersLoadResponse({
                        store: content,
                        file: file,
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.FiltersLoadResponse({
                        file: file,
                        error: this._logger.warn(`Fail to open file "${file}" due error: ${error.message}`),
                    }));
                });
            });
        } else {
            this._loadFile(request.file).then((content: string) => {
                ServiceFileRecent.saveFilters(request.file as string, 0); // TODO: detect count of entities to save
                response(new IPCMessages.FiltersLoadResponse({
                    store: content,
                    file: request.file as string,
                }));
            }).catch((error: Error) => {
                return response(new IPCMessages.FiltersLoadResponse({
                    file: request.file as string,
                    error: this._logger.warn(`Fail to open file "${request.file}" due error: ${error.message}`),
                }));
            });
        }
    }

    private _ipc_onFiltersSaveRequest(message: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        const request: IPCMessages.FiltersSaveRequest = message as IPCMessages.FiltersSaveRequest;
        if (typeof request.file === 'string') {
            if (!fs.existsSync(request.file)) {
                request.file = undefined;
            }
        }
        if (typeof request.file === 'string') {
            this._saveFile(request.file, request.store).then(() => {
                ServiceFileRecent.saveFilters(request.file as string, request.count);
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
                this._saveFile(results.filePath, request.store).then(() => {
                    ServiceFileRecent.saveFilters(results.filePath as string, request.count);
                    response(new IPCMessages.FiltersSaveResponse({
                        filename: results.filePath as string,
                    }));
                }).catch((error: Error) => {
                    this._logger.warn(`Error during saving filters into file "${results.filePath}": ${error.message}`);
                    response(new IPCMessages.FiltersSaveResponse({
                        filename: results.filePath as string,
                        error: error.message,
                    }));
                });
            });
        }
    }

    private _loadFile(file: string): Promise<string> {
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
                        const content: any = JSON.parse(data);
                        if (typeof content !== 'object' || content === null) {
                            return reject(new Error(`Fail to parse file "${file}" because content isn't an object.`));
                        }
                        resolve(data);
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
}

export default (new ServiceFilters());
