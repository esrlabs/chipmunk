import Logger from '../tools/env.logger';
import { ControllerStreamSearchEngine } from './controller.stream.search.engine';
import State from './controller.stream.search.state';
import { IMapItem } from './controller.stream.search.map.state';
import ControllerStreamSearchMapGenerator, { IFoundEvent } from './controller.stream.search.map.generator';
import ControllerStreamSearchMapInspector from './controller.stream.search.map.inspector';
import { CancelablePromise } from '../tools/promise.cancelable';
import { EventEmitter } from 'events';

export type TMap = { [key: number]: string[] };
export type TStats = { [key: string]: number };

export interface IMapData {
    map: TMap;
    stats: TStats;
}

export { IFoundEvent };

export interface IRange {
    from: number;
    to: number;
}

export default class ControllerStreamSearchExecutor extends EventEmitter {

    public static Events = {
        found: 'found',
    };

    private _logger: Logger;
    private _mapping: ControllerStreamSearchMapGenerator;
    private _inspector: ControllerStreamSearchMapInspector;
    private _engine: ControllerStreamSearchEngine;
    private _state: State;
    private _tasks: {
        main: CancelablePromise<IMapItem[], void> | undefined,
        search: CancelablePromise<boolean, void> | Error | undefined,
        mapping: CancelablePromise<IMapItem[], void> | Error | undefined,
        inspecting: CancelablePromise<IMapData, void> | Error | undefined,
    } = {
        main: undefined,
        search: undefined,
        mapping: undefined,
        inspecting: undefined,
    };

    constructor(state: State) {
        super();
        this._state = state;
        this._logger = new Logger(`ControllerStreamSearchTask: ${this._state.getGuid()}`);
        this._engine = new ControllerStreamSearchEngine(this._state.getStreamFile(), this._state.getSearchFile());
        this._mapping = new ControllerStreamSearchMapGenerator(this._state.getGuid(), this._state.getSearchFile());
        this._inspector = new ControllerStreamSearchMapInspector(this._state.getGuid(), this._state.getSearchFile());
        // Add listeners
        this._mapping.on(ControllerStreamSearchMapGenerator.Events.found, (event: IFoundEvent) => {
            this.emit(ControllerStreamSearchExecutor.Events.found, event);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.removeAllListeners();
            this.cancel();
            resolve();
        });
    }

    public search(requests: RegExp[], searchRequestId: string, from?: number, to?: number): CancelablePromise<IMapItem[], void> | Error {
        if (this._tasks.main !== undefined) {
            const msg: string = `Fail to start search, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        this._tasks.main = new CancelablePromise((resolve, reject) => {
            if (typeof from === 'number' && typeof to === 'number') {
                this._tasks.search = this._engine.append(from, to);
            } else {
                this._tasks.search = this._engine.search(requests, searchRequestId);
            }
            if (this._tasks.search instanceof Error) {
                return reject(new Error(`Fail to start engine.search due error: ${this._tasks.search.message}`));
            }
            this._tasks.search.then(() => {
                if (typeof from === 'number' && typeof to === 'number') {
                    this._tasks.mapping = this._mapping.append(this._state.map.getByteLength(), this._state.map.getRowsCount());
                } else {
                    this._tasks.mapping = this._mapping.generate(this._state.map.getByteLength(), this._state.map.getRowsCount());
                }
                if (this._tasks.mapping instanceof Error) {
                    return reject(new Error(`Fail to start mapping due error: ${this._tasks.mapping.message}`));
                }
                // Start mapping
                this._tasks.mapping.then((map: IMapItem[]) => {
                    // Resolve
                    resolve(map);
                }).catch((mapGenerateErr: Error) => {
                    this._logger.warn(`Fail to generate map file due error: ${mapGenerateErr.message}`);
                    reject(mapGenerateErr);
                });
            }).catch((searchError: Error) => {
                reject(searchError);
            });
        });
        this._tasks.main.cancel(this._clear.bind(this))
                        .finally(this._clear.bind(this));
        return this._tasks.main;
    }

    public inspect(requests: RegExp[]): CancelablePromise<IMapData, void> | Error {
        if (this._tasks.inspecting !== undefined) {
            const msg: string = `Fail to start inspecting, because previous process isn't finished.`;
            this._logger.warn(msg);
            return new Error(msg);
        }
        const promises: { [key: string]: CancelablePromise<number[], void> } = {};
        const measure = this._logger.measure(`inspecting`);
        this._tasks.inspecting = new CancelablePromise((resolve, reject) => {
            const results: IMapData = {
                stats: {},
                map: {},
            };
            requests.forEach((request: RegExp) => {
                const promise: CancelablePromise<number[], void> | Error = this._engine.match(request, 0);
                if (promise instanceof Error) {
                    this._logger.warn(`Fail to start inspector due error: ${promise.message}`);
                    return false;
                }
                const source = request.source;
                promises[source] = promise;
                promise.then((lines: number[]) => {
                    const measureLocal = this._logger.measure(`processing "${source}"`);
                    results.stats[source] = lines.length;
                    lines.forEach((line: number) => {
                        if (results.map[line] === undefined) {
                            results.map[line] = [source];
                        } else if (results.map[line].indexOf(source) === -1) {
                            results.map[line].push(request.source);
                        }
                    });
                    delete promises[request.source];
                    measureLocal();
                    if (Object.keys(promises).length === 0) {
                        return resolve(results);
                    }
                }).catch((error: Error) => {
                    this._logger.warn(`Fail to inspect request "${request.source}" due error: ${error.message}`);
                    reject(error);
                });
            });
            if (Object.keys(promises).length === 0) {
                return resolve(results);
            }
        });
        this._tasks.inspecting.cancel(() => {
            Object.keys(promises).forEach((key: string) => {
                promises[key].break();
            });
            this._tasks.inspecting = undefined;
            this._logger.env(`Inspecting was canceled.`);
        }).finally(() => {
            this._tasks.inspecting = undefined;
            measure();
        });
        return this._tasks.inspecting;
    }

    public cancel() {
        if (this._tasks.main !== undefined) {
            this._tasks.main.break();
        }
        if (this._tasks.inspecting === undefined) {
            return;
        }
        if (this._tasks.inspecting instanceof Error) {
            return;
        }
        this._tasks.inspecting.break();
    }

    public isWorking(): boolean {
        if (this._tasks.main !== undefined || (this._tasks.inspecting !== undefined && !(this._tasks.inspecting instanceof Error))) {
            return true;
        }
        return false;
    }

    private _clear() {
        this._tasks.main = undefined;
        if (this._tasks.search !== undefined && !(this._tasks.search instanceof Error)) {
            this._tasks.search.break();
        }
        if (this._tasks.mapping !== undefined && !(this._tasks.mapping instanceof Error)) {
            this._tasks.mapping.break();
        }
        this._tasks.search = undefined;
        this._tasks.mapping = undefined;
    }

}
