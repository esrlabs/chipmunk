import Logger from '../../../tools/env.logger';
import guid from '../../../tools/tools.guid';
import State from '../state';
import { IMapItem } from '../file.map';
import * as fs from 'fs';
import { CancelablePromise } from '../../../tools/promise.cancelable';
import { EventEmitter } from 'events';
import ServiceStreams from '../../../services/service.streams';
import { OperationSearch, IMapChunkEvent } from './operation.search';
import { OperationAppend } from './operation.append';
import { OperationInspecting } from './operation.inspecting';

export type TMap = { [key: number]: string[] };
export type TStats = { [key: string]: number };

export interface IMapData {
    map: TMap;
    stats: TStats;
}

export { IMapChunkEvent };

export interface IRange {
    from: number;
    to: number;
}

export class SearchEngine extends EventEmitter {

    public static Events = {
        onMapUpdated: 'onMapUpdated',
    };

    private _logger: Logger;
    private _state: State;
    private _stock: {
        search: Map<string, CancelablePromise<any, void>>,
        inspecting: Map<string, CancelablePromise<any, void>>,
    } = {
        search: new Map(),
        inspecting: new Map(),
    };
    private _operations: {
        search: OperationSearch,
        append: OperationAppend,
        inspecting: OperationInspecting,
    };

    constructor(state: State) {
        super();
        this._state = state;
        this._logger = new Logger(`ControllerSearchEngine: ${this._state.getGuid()}`);
        // Create operations controllers
        this._operations = {
            search: new OperationSearch(this._state.getGuid(), this._state.getStreamFile(), this._state.getSearchFile()),
            append: new OperationAppend(this._state.getGuid(), this._state.getStreamFile(), this._state.getSearchFile()),
            inspecting: new OperationInspecting(this._state.getGuid(), this._state.getStreamFile(), this._state.getSearchFile()),
        };
        // Listen map events
        this._onMapUpdated = this._onMapUpdated.bind(this);
        this._operations.search.on(OperationSearch.Events.onMapUpdated, this._onMapUpdated);
        this._operations.append.on(OperationAppend.Events.onMapUpdated, this._onMapUpdated);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.removeAllListeners();
            this.cancel();
            resolve();
        });
    }

    public search(requests: RegExp[], from?: number, to?: number): CancelablePromise<IMapItem[], void> | Error {
        if (this._stock.search.size !== 0) {
            return new Error(`Fail to start search because previous wasn't finished.`);
        }
        let error: CancelablePromise<IMapItem[], void> | Error;
        // Drop last cursor point because search is new
        if (typeof from !== 'number' || typeof to !== 'number') {
            this._operations.append.dropCursorPosition();
        }
        // Try to create task
        if (typeof from === 'number' && typeof to === 'number') {
            // Call append operation
            error = this._operations.append.perform(requests, {
                from: from,
                to: to,
            }, {
                bytes: this._state.map.getByteLength(),
                rows: this._state.map.getRowsCount(),
            });
        } else {
            // Call search operation
            error = this._operations.search.perform(requests, {
                bytes: this._state.map.getByteLength(),
                rows: this._state.map.getRowsCount(),
            });
        }
        // Break if failed (could be one reason: previous operation is still going)
        if (error instanceof Error) {
            this._logger.error(`Fail perform operation due error: ${error.message}`);
            return error;
        }
        // Resolve TS types issue
        const task = (error as CancelablePromise<IMapItem[], void>);
        // Wrap task to track it
        return new CancelablePromise<IMapItem[], void>((resolve, reject) => {
            // Tracking guid
            const taskId: string = guid();
            // Store task into stock
            this._stock.search.set(taskId, task);
            // Start tracking
            ServiceStreams.addProgressSession(taskId, 'search', this._state.getGuid());
            ServiceStreams.updateProgressSession(taskId, 0, this._state.getGuid());
            // Handeling finishing
            task.then((map: IMapItem[]) => {
                resolve(map);
            }).cancel(() => {
                this._logger.env(`Search was canceled.`);
            }).catch((searchErr: Error) => {
                reject(searchErr);
            }).finally(() => {
                ServiceStreams.removeProgressSession(taskId, this._state.getGuid());
                this._stock.search.delete(taskId);
            });
        }).cancel(() => {
            task.break();
        });
    }

    public inspect(requests: RegExp[]): CancelablePromise<IMapData, void> | Error {
        if (this._stock.inspecting.size !== 0) {
            return new Error(`Fail to start inspecting because previous wasn't finished.`);
        }
        // Define ID of whole task
        const taskId: string = guid();
        // Start measuring
        const measure = this._logger.measure(`inspecting`);
        // Start tracking
        ServiceStreams.addProgressSession(taskId, 'inspecting', this._state.getGuid());
        ServiceStreams.updateProgressSession(taskId, 0, this._state.getGuid());
        // Create closure task storage
        const stock: Map<string, CancelablePromise<number[], void>> = new Map();
        // Create tasks
        return new CancelablePromise<IMapData, void>((resolve, reject, cancel, self) => {
            // Store parent task
            this._stock.inspecting.set(taskId, self);
            // Results storage
            const results: IMapData = {
                stats: {},
                map: {},
            };
            // Create task for each regexp
            requests.forEach((request: RegExp) => {
                // Task id
                const requestTaskId: string = guid();
                // Task
                const task: CancelablePromise<number[], void> = this._operations.inspecting.perform(request, 0);
                // Store task
                stock.set(requestTaskId, task);
                // Processing results
                task.then((lines: number[]) => {
                    const measurePostProcessing = this._logger.measure(`processing "${request.source}"`);
                    results.stats[request.source] = lines.length;
                    lines.forEach((line: number) => {
                        if (results.map[line] === undefined) {
                            results.map[line] = [request.source];
                        } else if (results.map[line].indexOf(request.source) === -1) {
                            results.map[line].push(request.source);
                        }
                    });
                    measurePostProcessing();
                    stock.delete(requestTaskId);
                    if (stock.size === 0) {
                        return resolve(results);
                    }
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to inspect request "${request.source}" due error: ${error.message}`);
                    reject(error);
                });
            });
            self.finally(() => {
                // Remove unfinishing task (because in case of cancel we also will be here)
                stock.forEach((notFinishedTask: CancelablePromise<number[], void>) => {
                    notFinishedTask.break();
                });
                stock.clear();
                // Drop progress tracking
                ServiceStreams.removeProgressSession(taskId, this._state.getGuid());
                // Clean tasks stock
                this._stock.inspecting.delete(taskId);
                measure();
            });
        }).cancel(() => {
            this._logger.env(`Inspecting was canceled.`);
        });
    }

    public cancel() {
        this._stock.search.forEach((task: CancelablePromise<any, void>) => {
            task.break();
        });
        this._stock.inspecting.forEach((task: CancelablePromise<any, void>) => {
            task.break();
        });
        this._stock.search.clear();
        this._stock.inspecting.clear();
    }

    public isWorking(): boolean {
        return (this._stock.search.size + this._stock.inspecting.size) > 0;
    }

    private _onMapUpdated(event: IMapChunkEvent) {
        this.emit(SearchEngine.Events.onMapUpdated, event);
    }

}
