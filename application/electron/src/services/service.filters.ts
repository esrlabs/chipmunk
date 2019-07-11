import Logger from '../tools/env.logger';
import { dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IService } from '../interfaces/interface.service';
import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';

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
            ServiceElectron.IPC.subscribe(IPCElectronMessages.FiltersLoadRequest, this._ipc_onFiltersLoadRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.FiltersLoadRequest = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "FiltersLoadRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
            });
            ServiceElectron.IPC.subscribe(IPCElectronMessages.FiltersSaveRequest, this._ipc_onFiltersSaveRequest.bind(this)).then((subscription: Subscription) => {
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

    private _ipc_onFiltersLoadRequest(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => Promise<void>) {
        dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles'],
            filters: [{ name: 'Text Files', extensions: ['txt']}],
        }, (files: string[] | undefined) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            const file: string = files[0];
            fs.stat(file, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
                if (error) {
                    return response(new IPCElectronMessages.FiltersLoadResponse({
                        filters: [],
                        error: error.message,
                    }));
                }
                fs.readFile(file, (readingError: NodeJS.ErrnoException | null, data: Buffer | string) => {
                    if (readingError) {
                        return response(new IPCElectronMessages.FiltersLoadResponse({
                            filters: [],
                            error: this._logger.warn(`Fail to read file "${file}" due error: ${readingError.message}`),
                        }));
                    }
                    data = data.toString();
                    try {
                        const filters = JSON.parse(data);
                        if (!(filters instanceof Array)) {
                            return response(new IPCElectronMessages.FiltersLoadResponse({
                                filters: [],
                                error: this._logger.warn(`Fail to parse file "${file}" because content isn't an Array.`),
                            }));
                        }
                        response(new IPCElectronMessages.FiltersLoadResponse({
                            filters: filters,
                        }));
                    } catch (e) {
                        return response(new IPCElectronMessages.FiltersLoadResponse({
                            filters: [],
                            error: this._logger.warn(`Fail to parse file "${file}" due error: ${e.message}`),
                        }));
                    }
                });
            });
        });
    }

    private _ipc_onFiltersSaveRequest(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => Promise<void>) {
        const content: string = JSON.stringify((message as IPCElectronMessages.FiltersSaveRequest).filters);
        dialog.showSaveDialog({
            title: 'Saving filters',
            filters: [{ name: 'Text Files', extensions: ['txt']}],
        }, (filename: string | undefined) => {
            if (filename === undefined) {
                return;
            }
            fs.writeFile(filename, content, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    this._logger.warn(`Error during saving filters into file "${filename}": ${error.message}`);
                }
                response(new IPCElectronMessages.FiltersSaveResponse({
                    filename: path.basename(filename),
                    error: error ? error.message : undefined,
                }));
            });
        });
    }

}

export default (new ServiceFilters());
