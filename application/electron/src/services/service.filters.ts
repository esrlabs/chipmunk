import Logger from '../tools/env.logger';
import { dialog, SaveDialogReturnValue, OpenDialogReturnValue } from 'electron';
import * as fs from 'fs';
import { IService } from '../interfaces/interface.service';
import ServiceElectron, { IPCMessages, Subscription } from './service.electron';
import ServiceFileRecent from './files/service.file.recent';

interface IStoredFileData {
    filters: IPCMessages.IFilter[];
    charts: IPCMessages.IChartSaveRequest[];
}

function normalizeStoredFilters(filters: any[]): IPCMessages.IFilter[] {
    // back compatibility for filters
    if (!(filters instanceof Array)) {
        return [];
    }
    return filters.map((filter: any) => {
        const expression: IPCMessages.ISearchExpression = {
            request: typeof filter.reg === 'string' ? filter.reg : filter.expression.request,
            flags: typeof filter.expression === 'object' ? filter.expression.flags : {
                casesensitive: false,
                wholeword: false,
                regexp: true,
            },
        };
        return {
            expression: expression,
            color: typeof filter.color === 'string' ? filter.color : '',
            background: typeof filter.background === 'string' ? filter.background : '',
            active: typeof filter.active === 'boolean' ? filter.active : true,
        };
    }).filter((filter: IPCMessages.IFilter) => {
        return filter.expression.request !== '';
    });
}

function normalizeStoredCharts(charts: any[]): IPCMessages.IChartSaveRequest[] {
    // back compatibility for charts
    if (!(charts instanceof Array)) {
        return [];
    }
    return charts.map((chart: any) => {
        return {
            color: typeof chart.color === 'string' ? chart.color : '',
            request: typeof chart.reg === 'string' ? chart.reg : chart.request,
            active: typeof chart.active === 'boolean' ? chart.active : true,
            options: typeof chart.options === 'object' ? chart.options : {},
            type: typeof chart.type === 'string' ? chart.type : '',
        };
    }).filter((chart: IPCMessages.IChartSaveRequest) => {
        return chart.request !== '' && (chart as any).type !== '';
    });
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
            ServiceFileRecent.init();
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
                    ServiceFileRecent.saveFilters(file, content.filters.length + content.charts.length);
                    response(new IPCMessages.FiltersLoadResponse({
                        filters: normalizeStoredFilters(content.filters),
                        charts: normalizeStoredCharts(content.charts),
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
                ServiceFileRecent.saveFilters(request.file as string, content.filters.length + content.charts.length);
                response(new IPCMessages.FiltersLoadResponse({
                    filters: normalizeStoredFilters(content.filters),
                    charts: normalizeStoredCharts(content.charts),
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
                ServiceFileRecent.saveFilters(request.file as string, request.filters.length);
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
                    ServiceFileRecent.saveFilters(results.filePath as string, request.filters.length);
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
}

export default (new ServiceFilters());
