import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabSearchOutput } from './controller.session.tab.search.output';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionTabSearchState} from './controller.session.tab.search.state';
import { ControllerSessionTabSearchViewState } from './controller.session.tab.search.view.state';
import { ControllerSessionScope } from './controller.session.tab.scope';
import QueueService, { IQueueController } from '../services/standalone/service.queue';
import * as Toolkit from 'logviewer.client.toolkit';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';
import * as ColorScheme from '../theme/colors';

export interface IControllerSessionStream {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    transports: string[];
    scope: ControllerSessionScope;
}

export interface IRequest {
    reg: RegExp;
    color: string;
    background: string;
    active: boolean;
}


export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _queue: Toolkit.Queue;
    private _queueController: IQueueController | undefined;
    private _guid: string;
    private _active: RegExp[] = [];
    private _stored: IRequest[] = [];
    private _subjects: {
        onRequestsUpdated: Subject<IRequest[]>,
        onDropped: Subject<void>,
    } = {
        onRequestsUpdated: new Subject<IRequest[]>(),
        onDropped: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _scope: ControllerSessionScope;
    private _output: ControllerSessionTabSearchOutput;
    private _state: ControllerSessionTabSearchState;
    private _view: ControllerSessionTabSearchViewState;
    private _results: {
        matches: number[],
    } = {
        matches: [],
    };

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearch: ${params.guid}`);
        this._scope = params.scope;
        this._output = new ControllerSessionTabSearchOutput({
            guid: params.guid,
            requestDataHandler: this._requestStreamData.bind(this),
            stream: params.stream,
            getActiveSearchRequests: this.getActiveAsRegs.bind(this),
            scope: this._scope,
        });
        this._queue = new Toolkit.Queue(this._logger.error.bind(this._logger), 0);
        this._state = new ControllerSessionTabSearchState(params.guid);
        this._view = new ControllerSessionTabSearchViewState(params.guid);
        // Subscribe to queue events
        this._queue_onDone = this._queue_onDone.bind(this);
        this._queue_onNext = this._queue_onNext.bind(this);
        this._queue.subscribe(Toolkit.Queue.Events.done, this._queue_onDone);
        this._queue.subscribe(Toolkit.Queue.Events.next, this._queue_onNext);
        ServiceElectronIpc.subscribe(IPCMessages.SearchUpdated, this._ipc_onSearchUpdated.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            this._output.destroy();
            this._queue.unsubscribeAll();
            OutputParsersService.unsetSearchResults(this._guid);
            resolve();
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabSearchOutput {
        return this._output;
    }

    public getObservable(): {
        onRequestsUpdated: Observable<IRequest[]>,
        onDropped: Observable<void>,
    } {
        return {
            onRequestsUpdated: this._subjects.onRequestsUpdated.asObservable(),
            onDropped: this._subjects.onDropped.asObservable(),
        };
    }

    public search(requestId: string, requests: RegExp[], filters: boolean = false, cancelPrev: boolean = true): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            if (!this._state.isDone() && !cancelPrev) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            if (!this._state.isDone() && cancelPrev) {
                const toBeCancelReq: string = this._state.getId();
                this.cancel(toBeCancelReq).then(() => {
                    this._search(requestId, requests, filters).then((res: number | undefined) => {
                        resolve(res);
                    }).catch((err: Error) => {
                        reject(err);
                    });
                }).catch((cancelErr: Error) => {
                    this._logger.warn(`Fail to cancel request ${toBeCancelReq} due error: ${cancelErr.message}`);
                    reject(cancelErr);
                });
            } else {
                this._search(requestId, requests, filters).then((res: number | undefined) => {
                    resolve(res);
                }).catch((err: Error) => {
                    reject(err);
                });
            }
        });
    }

    public cancel(requestId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._state.equal(requestId)) {
                this._logger.env(`Request ${requestId} isn't actual. No need to cancel.`);
                return resolve();
            }
            ServiceElectronIpc.request(new IPCMessages.SearchRequestCancelRequest({
                streamId: this._guid,
                requestId: requestId,
            }), IPCMessages.SearchRequestCancelResponse).then((results: IPCMessages.SearchRequestCancelResponse) => {
                if (results.error !== undefined) {
                    this._logger.error(`Search request id ${results.requestId} fail to cancel with error: ${results.error}`);
                    return reject(new Error(results.error));
                }
                // Cancel
                this._state.cancel();
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public drop(requestId: string): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            if (!this._state.isDone()) {
                const toBeCancelReq: string = this._state.getId();
                this.cancel(toBeCancelReq).then(() => {
                    this._drop(requestId).then((res: number | undefined) => {
                        resolve(res);
                    }).catch((err: Error) => {
                        reject(err);
                    });
                }).catch((cancelErr: Error) => {
                    this._logger.warn(`Fail to cancel request ${toBeCancelReq} due error: ${cancelErr.message}`);
                    reject(cancelErr);
                });
            } else {
                this._drop(requestId).then((res: number | undefined) => {
                    resolve(res);
                }).catch((err: Error) => {
                    reject(err);
                });
            }
        });
    }

    public isRequestStored(request: string): boolean {
        let result: boolean = false;
        this._stored.forEach((stored: IRequest) => {
            if (request === stored.reg.source) {
                result = true;
            }
        });
        return result;
    }

    public addStored(request: string): Error | undefined {
        if (this.isRequestStored(request)) {
            return new Error(`Request "${request}" already exist`);
        }
        if (!Toolkit.regTools.isRegStrValid(request)) {
            return new Error(`Not valid regexp "${request}"`);
        }
        this._stored.push({
            reg: Toolkit.regTools.createFromStr(request) as RegExp,
            color: ColorScheme.scheme_color_0,
            background: ColorScheme.scheme_color_2,
            active: true,
        });
        this._subjects.onRequestsUpdated.next(this._stored);
        this._applyFilters();
        return undefined;
    }

    public insertStored(requests: IRequest[]) {
        this._stored.push(...requests);
        this._subjects.onRequestsUpdated.next(this._stored);
        this._applyFilters();
    }

    public removeStored(request: string) {
        const count: number = this._stored.length;
        this._stored = this._stored.filter((stored: IRequest) => {
            return request !== stored.reg.source;
        });
        this._subjects.onRequestsUpdated.next(this._stored);
        if (count > 0 && this._stored.length === 0) {
            this.drop(Toolkit.guid()).then(() => {
                OutputParsersService.setHighlights(this.getGuid(), this._stored.slice());
                OutputParsersService.updateRowsView();
            }).catch((error: Error) => {
                this._logger.error(`Fail to drop search results`);
            });
        } else {
            this._applyFilters();
        }
    }

    public removeAllStored() {
        const count: number = this._stored.length;
        this._stored = [];
        if (count === 0) {
            return;
        }
        this.drop(Toolkit.guid()).then(() => {
            OutputParsersService.setHighlights(this.getGuid(), this._stored.slice());
            OutputParsersService.updateRowsView();
        }).catch((error: Error) => {
            this._logger.error(`Fail to drop search results of stored filters`);
        });
        this._subjects.onRequestsUpdated.next([]);
    }

    public updateStored(request: string, updated: { reguest?: string, color?: string, background?: string, active?: boolean }) {
        let isUpdateRequired: boolean = false;
        const active: number = this.getActiveStored().length;
        this._stored = this._stored.map((stored: IRequest) => {
            if (request === stored.reg.source) {
                if (updated.reguest !== undefined && stored.reg.source !== updated.reguest) {
                    isUpdateRequired = true;
                }
                if (updated.active !== undefined && stored.active !== updated.active) {
                    isUpdateRequired = true;
                }
                stored.reg = updated.reguest === undefined ? stored.reg : Toolkit.regTools.createFromStr(updated.reguest) as RegExp;
                stored.color = updated.color === undefined ? stored.color : updated.color;
                stored.background = updated.background === undefined ? stored.background : updated.background;
                stored.active = updated.active === undefined ? stored.active : updated.active;
            }
            return stored;
        });
        this._subjects.onRequestsUpdated.next(this.getStored());
        if (isUpdateRequired) {
            if (this.getActiveStored().length === 0 && active !== 0) {
                this.drop(Toolkit.guid()).then(() => {
                    OutputParsersService.setHighlights(this.getGuid(), this.getStored());
                    OutputParsersService.updateRowsView();
                }).catch((error: Error) => {
                    this._logger.error(`Fail to drop search results of stored filters due error: ${error.message}`);
                });
            } else {
                this._applyFilters();
            }
        } else {
            OutputParsersService.setHighlights(this.getGuid(), this.getStored());
            OutputParsersService.updateRowsView();
        }
    }

    public overwriteStored(requests: IRequest[]) {
        this._stored = requests.map((filter: IRequest) => {
            return Object.assign({}, filter);
        });
        this._subjects.onRequestsUpdated.next(this.getStored());
        if (this.getActiveStored().length === 0) {
            this.drop(Toolkit.guid()).then(() => {
                OutputParsersService.setHighlights(this.getGuid(), this.getStored());
                OutputParsersService.updateRowsView();
            }).catch((error: Error) => {
                this._logger.error(`Fail to drop search results of stored filters due error: ${error.message}`);
            });
        } else {
            this._applyFilters();
        }
    }

    public getStored(): IRequest[] {
        return this._stored.map((filter: IRequest) => {
            return Object.assign({}, filter);
        });
    }

    public getActiveStored(): IRequest[] {
        return this._stored.filter((request: IRequest) => request.active);
    }

    public getActiveAsRegs(): RegExp[] {
        return this._active;
    }

    public getAppliedRequests(): IRequest[] {
        if (this._active.length > 0) {
            return this._active.map((reg: RegExp) => {
                const stored: IRequest | undefined = this._stored.find(s => s.reg.source === reg.source);
                return stored !== undefined ? stored : { reg: reg, color: '', background: '', active: false };
            });
        } else {
            return this._stored;
        }
    }

    public getCloseToMatch(row: number): { row: number, index: number } {
        if (this._results.matches.length === 0) {
            return { row: -1, index: -1 };
        }
        for (let i = this._results.matches.length - 1; i >= 0; i -= 1) {
            const cur: number = this._results.matches[i];
            if (cur === row) {
                return { row: row, index: i };
            }
            if (cur < row) {
                if (i !== this._results.matches.length - 1) {
                    const prev: number = this._results.matches[i + 1];
                    return { row: (row - cur) < (prev - row) ? cur : prev, index: (row - cur) < (prev - row) ? i : (i + 1)};
                }
                return { row: cur, index: i};
            }
        }
        return { row: this._results.matches[0], index: 0 };
    }

    public getViewState(): ControllerSessionTabSearchViewState {
        return this._view;
    }

    public getRequestColor(source: string): string | undefined {
        let color: string | undefined;
        this._stored.forEach((filter: IRequest) => {
            if (color !== undefined) {
                return;
            }
            if (filter.reg.source === source) {
                color = filter.background;
            }
        });
        return color;
    }

    private _search(requestId: string, requests: RegExp[], filters: boolean = false): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            if (!this._state.isDone()) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            this._state.start(requestId, resolve, reject);
            if (!filters) {
                // Save active requests
                this._active = requests;
            }
            // Drop results
            this._results = {
                matches: [],
            };
            // Drop output
            this._output.clearStream();
            // Start search
            ServiceElectronIpc.request(new IPCMessages.SearchRequest({
                requests: requests.map((reg: RegExp) => {
                    return {
                        source: reg.source,
                        flags: reg.flags
                    };
                }),
                streamId: this._guid,
                requestId: requestId,
            }), IPCMessages.SearchRequestResults).then((results: IPCMessages.SearchRequestResults) => {
                this._logger.env(`Search request ${results.requestId} was finished in ${((results.duration) / 1000).toFixed(2)}s.`);
                if (results.error !== undefined) {
                    // Some error during processing search request
                    this._logger.error(`Search request id ${results.requestId} was finished with error: ${results.error}`);
                    return this._state.fail(new Error(results.error));
                }
                // Share results
                OutputParsersService.setSearchResults(this._guid, requests.map((reg: RegExp) => {
                    return { reg: reg, color: undefined, background: undefined };
                }));
                // Update stream for render
                this._output.updateStreamState(results.found);
                // Done
                this._state.done(results.found);
            }).catch((error: Error) => {
                this._state.fail(error);
            });
        });
    }

    private _drop(requestId: string): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            // Drop active requests
            this._active = [];
            if (!this._state.isDone()) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            this._state.start(requestId, resolve, reject);
            // Drop results
            this._results = {
                matches: [],
            };
            // Drop output
            this._output.clearStream();
            // Trigger event
            this._subjects.onDropped.next();
            // Start search
            ServiceElectronIpc.request(new IPCMessages.SearchRequest({
                requests: [],
                streamId: this._guid,
                requestId: requestId,
            }), IPCMessages.SearchRequestResults).then((results: IPCMessages.SearchRequestResults) => {
                this._logger.env(`Search request ${results.requestId} was finished in ${((results.duration) / 1000).toFixed(2)}s.`);
                if (results.error !== undefined) {
                    // Some error during processing search request
                    this._logger.error(`Search request id ${results.requestId} was finished with error: ${results.error}`);
                    return this._state.fail(new Error(results.error));
                }
                // Share results
                OutputParsersService.setSearchResults(this._guid, []);
                // Update stream for render
                this._output.updateStreamState(results.found);
                // Done
                this._state.done(0);
                // Aplly filters if exsists
                this._applyFilters();
            }).catch((error: Error) => {
                this._state.fail(error);
            });
        });
    }

    private _applyFilters() {
        if (this._active.length > 0) {
            return;
        }
        const active: IRequest[] = this.getActiveStored();
        if (active.length === 0) {
            return;
        }
        const requestId: string = Toolkit.guid();
        this.search(requestId, active.map((request: IRequest) => {
            return request.reg;
        }), true).then(() => {
            OutputParsersService.setHighlights(this.getGuid(), this._stored.slice());
            OutputParsersService.updateRowsView();
        }).catch((error: Error) => {
            this._logger.error(`Cannot apply filters due error: ${error.message}`);
        });
    }

    private _requestStreamData(start: number, end: number): Promise<IPCMessages.SearchChunk> {
        return new Promise((resolve, reject) => {
            const s = Date.now();
            ServiceElectronIpc.request(
                new IPCMessages.SearchChunk({
                    guid: this._guid,
                    start: start,
                    end: end
                }), IPCMessages.SearchChunk
            ).then((response: IPCMessages.SearchChunk) => {
                this._logger.env(`Chunk [${start} - ${end}] is read in: ${((Date.now() - s) / 1000).toFixed(2)}s`);
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.warn(`Request to stream chunk was finished within error: ${response.error}`)));
                }
                resolve(response);
            });
        });
    }

    private _queue_onNext(done: number, total: number) {
        if (this._queueController === undefined) {
            this._queueController = QueueService.create('reading');
        }
        this._queueController.next(done, total);
    }

    private _queue_onDone() {
        if (this._queueController === undefined) {
            return;
        }
        this._queueController.done();
        this._queueController = undefined;
    }

    private _ipc_onSearchUpdated(message: IPCMessages.StreamUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        this._output.updateStreamState(message.rowsCount);
    }


}
