import { Observable, Subject, Subscription } from 'rxjs';
import { FiltersStorage, FilterRequest } from './controller.session.tab.search.filters.storage';
import { ChartsStorage, ChartRequest } from './controller.session.tab.search.charts.storage';
import { ControllerSessionTabSearchState} from './controller.session.tab.search.state';
import { ControllerSessionScope } from './controller.session.tab.scope';

import ElectronIpcService, { IPCMessages } from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export class ControllerSessionTabSearchRecent {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };
    private _subjects: {
        filename: Subject<string>,
    } = {
        filename: new Subject<string>(),
    };
    private _filename: string = '';
    private _filters: FiltersStorage;
    private _charts: ChartsStorage;

    constructor(
        guid: string,
        filters: FiltersStorage,
        charts: ChartsStorage,
    ) {
        this._guid = guid;
        this._filters = filters;
        this._charts = charts;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchRecent: ${guid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getObservable(): {
        filename: Observable<string>,
    } {
        return {
            filename: this._subjects.filename.asObservable(),
        };
    }

    public getCurrentFile(): string {
        return this._filename;
    }

    public getFiltersStorage(): FiltersStorage {
        return this._filters;
    }

    public getChartsStorage(): ChartsStorage {
        return this._charts;
    }

    public load(file?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FiltersLoadRequest({
                file: file,
            }), IPCMessages.FiltersLoadResponse).then((response: IPCMessages.FiltersLoadResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                // Drop data in storage
                this._filters.clear();
                this._charts.clear();
                // Add new
                this._filters.add(response.filters.map((filter: IPCMessages.IFilter) => {
                    return {
                        request: filter.expression.request,
                        flags: filter.expression.flags,
                        color: filter.color,
                        background: filter.background,
                        state: filter.active,
                    };
                }));
                this._charts.add(response.charts.map((chart: IPCMessages.IChartSaveRequest) => {
                    return {
                        request: chart.request,
                        type: chart.type,
                        color: chart.color,
                        state: chart.active,
                        options: chart.options,
                    };
                }));
                this.setCurrentFile(response.file);
                resolve(response.file);
            }).catch((error: Error) => {
                this._logger.error(`Fail to load filters due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public save(filename: string): Promise<string> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FiltersSaveRequest({
                filters: this._filters.get().map((filter: FilterRequest) => {
                    const desc = filter.asDesc();
                    return {
                        expression: {
                            request: desc.request,
                            flags: desc.flags,
                        },
                        color: desc.color,
                        background: desc.background,
                        active: desc.active,
                    };
                }),
                charts: this._charts.get().map((chart: ChartRequest) => {
                    const desc = chart.asDesc();
                    return {
                        request: desc.request,
                        color: desc.color,
                        active: desc.active,
                        type: desc.type,
                        options: desc.options,
                    };
                }),
                file: typeof filename === 'string' ? filename : undefined,
            }), IPCMessages.FiltersSaveResponse).then((response: IPCMessages.FiltersSaveResponse) => {
                if (response.error !== undefined) {
                    return new Error(response.error);
                }
                this.setCurrentFile(response.filename);
                resolve(response.filename);
            }).catch((error: Error) => {
                this._logger.error(`Fail to save filters due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.FiltersFilesRecentResetRequest(), IPCMessages.FiltersFilesRecentResetResponse).then((message: IPCMessages.FiltersFilesRecentResetResponse) => {
                if (message.error) {
                    this._logger.error(`Fail to reset recent files due error: ${message.error}`);
                    return reject(new Error(message.error));
                }
                resolve();
            }).catch((error: Error) => {
                this._logger.error(`Fail to reset recent files due error: ${error.message}`);
                reject(error);
            });
        });
    }

    public setCurrentFile(filename: string) {
        this._filename = filename;
        this._subjects.filename.next(filename);
    }

}
