import Logger from '../tools/env.logger';
import { ControllerStreamSearchEngine } from './controller.stream.search.engine';
import State from './controller.stream.search.state';
import { IMapItem } from './controller.stream.search.map.state';
import ControllerStreamSearchMapGenerator, { IFoundEvent } from './controller.stream.search.map.generator';
import ControllerStreamSearchMapInspector, { IMapData } from './controller.stream.search.map.inspector';
import { CancelablePromise } from '../tools/promise.cancelable';
import { EventEmitter } from 'events';

export { IMapData, IFoundEvent };

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
        this._tasks.inspecting = this._inspector.get(0, requests);
        if (this._tasks.inspecting instanceof Error) {
            this._logger.warn(`Fail to start matching due error: ${this._tasks.inspecting.message}`);
            return this._tasks.inspecting;
        }
        this._tasks.inspecting.cancel(() => {
            this._tasks.inspecting = undefined;
            this._logger.env(`Innspecting was canceled.`);
        }).finally(() => {
            this._tasks.inspecting = undefined;
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
