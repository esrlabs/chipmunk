import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabSearchOutput } from './controller.session.tab.search.output';
import { ControllerSessionTabStreamOutput } from './controller.session.tab.stream.output';
import { ControllerSessionTabSearchState} from './controller.session.tab.search.state';
import { ControllerSessionScope } from './controller.session.tab.scope';
import {
    FilterRequest,
    IFilterFlags,
    IFilterDesc,
    IFiltersStorageUpdated,
    IFiltersChangeEvent,
    IFilterDescOptional,
    IFilterDescUpdating,
    FiltersStorage,
} from './controller.session.tab.search.filters.storage';

import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export { FilterRequest, IFilterFlags, FiltersStorage };

export interface IControllerSessionStreamFilters {
    guid: string;
    stream: ControllerSessionTabStreamOutput;
    scope: ControllerSessionScope;
}

export interface ISearchOptions {
    requestId: string;
    requests: RegExp[];
    filters?: boolean;
    cancelPrev?: boolean;
}

export interface ISubjects {
    updated: Subject<FiltersStorage>;
    searching: Subject<void>;
    complited: Subject<void>;
    dropped: Subject<void>;
}

export class ControllerSessionTabSearchFilters {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: FiltersStorage;
    private _subjects: ISubjects = {
        updated: new Subject<FiltersStorage>(),
        searching: new Subject<void>(),
        complited: new Subject<void>(),
        dropped: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };
    private _scope: ControllerSessionScope;
    private _output: ControllerSessionTabSearchOutput;
    private _state: ControllerSessionTabSearchState;
    private _requestedSearch: string | undefined;

    constructor(params: IControllerSessionStreamFilters) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchFilters: ${params.guid}`);
        this._scope = params.scope;
        this._output = new ControllerSessionTabSearchOutput({
            guid: params.guid,
            requestDataHandler: this._requestStreamData.bind(this),
            stream: params.stream,
            scope: this._scope,
        });
        this._storage = new FiltersStorage(params.guid);
        this._state = new ControllerSessionTabSearchState(params.guid);
        this._subscriptions.SearchUpdated = ServiceElectronIpc.subscribe(IPCMessages.SearchUpdated, this._ipc_onSearchUpdated.bind(this));
        this._subscriptions.onStorageUpdated = this._storage.getObservable().updated.subscribe(this._onStorageUpdated.bind(this));
        this._subscriptions.onStorageChanged = this._storage.getObservable().changed.subscribe(this._onStorageChanged.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // TODO: Cancelation of current
            this._storage.destroy().then(() => {
                this._output.destroy();
                OutputParsersService.unsetSearchResults(this._guid);
                resolve();
            });
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabSearchOutput {
        return this._output;
    }

    public getObservable(): {
        updated: Observable<FiltersStorage>,
        searching: Observable<void>,
        complited: Observable<void>,
        dropped: Observable<void>,
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            searching: this._subjects.searching.asObservable(),
            complited: this._subjects.complited.asObservable(),
            dropped: this._subjects.dropped.asObservable(),
        };
    }

    public search(requestId: string, requests?: FilterRequest | FilterRequest[]): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            if (!this._state.isDone()) {
                const toBeCancelReq: string = this._state.getId();
                this.cancel(toBeCancelReq).then(() => {
                    this._search(requestId, requests).then((res: number | undefined) => {
                        resolve(res);
                    }).catch((err: Error) => {
                        reject(err);
                    });
                }).catch((cancelErr: Error) => {
                    this._logger.warn(`Fail to cancel request ${toBeCancelReq} due error: ${cancelErr.message}`);
                    reject(cancelErr);
                });
            } else {
                this._search(requestId, requests).then((res: number | undefined) => {
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
            // Emit event
            this._scope.getSessionEventsHub().emit().onSearchUpdated({ rows: 0, session: this._guid });
        });
    }

    public getStorage(): FiltersStorage {
        return this._storage;
    }

    public getState(): ControllerSessionTabSearchState {
        return this._state;
    }

    private _onStorageUpdated(event: IFiltersStorageUpdated | undefined) {
        OutputParsersService.setHighlights(this.getGuid(), this.getStorage().get());
        OutputParsersService.updateRowsView();
        this._subjects.updated.next(this._storage);
        if (this._state.isLocked()) {
            // Do not apply search, because we have active search
            return;
        }
        if (this._storage.getActive().length === 0) {
            this.drop(Toolkit.guid()).catch((error: Error) => {
                this._logger.error(`Fail to drop search results of stored filters due error: ${error.message}`);
            });
        } else {
            this._update();
        }
    }

    private _onStorageChanged(event: IFiltersChangeEvent) {
        if (event.reapply) {
            this._onStorageUpdated(undefined);
        } else {
            OutputParsersService.setHighlights(this.getGuid(), this.getStorage().get());
            OutputParsersService.updateRowsView();
        }
    }

    private _search(requestId: string, requests?: FilterRequest | FilterRequest[]): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            let _requests: FilterRequest[] = [];
            if (requests === undefined) {
                _requests = this._storage.getActive();
            } else  if (!(requests instanceof Array)) {
                _requests = [requests];
            } else {
                _requests = requests;
            }
            if (!this._state.isDone()) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            this._state.start(requestId, resolve, reject);
            this._subjects.searching.next();
            // Drop output
            this._output.clearStream();
            // Start search
            ServiceElectronIpc.request(new IPCMessages.SearchRequest({
                requests: _requests.map(reg => reg.asIPC()),
                session: this._guid,
                id: requestId,
            }), IPCMessages.SearchRequestResults).then((results: IPCMessages.SearchRequestResults) => {
                this._subjects.complited.next();
                this._logger.env(`Search request ${results.requestId} was finished in ${((results.duration) / 1000).toFixed(2)}s.`);
                if (results.error !== undefined) {
                    // Some error during processing search request
                    this._logger.error(`Search request id ${results.requestId} was finished with error: ${results.error}`);
                    return this._state.fail(new Error(results.error));
                }
                // Share results
                OutputParsersService.setSearchResults(this._guid, _requests);
                // Update stream for render
                this._output.updateStreamState(results.found);
                // Done
                this._state.done(results.found);
            }).catch((error: Error) => {
                this._subjects.complited.next();
                this._state.fail(error);
            });
        });
    }

    private _drop(requestId: string): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            // Drop active requests
            if (!this._state.isDone()) {
                return reject(new Error(`Cannot start new search request while current isn't finished.`));
            }
            this._state.start(requestId, resolve, reject);
            // Drop output
            this._output.clearStream();
            // Trigger event
            this._subjects.dropped.next();
            // Start search
            ServiceElectronIpc.request(new IPCMessages.SearchRequest({
                requests: [],
                session: this._guid,
                id: requestId,
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
                this._output.updateStreamState(0);
                // Done
                this._state.done(0);
                // Aplly filters if exsists
                this._update();
            }).catch((error: Error) => {
                this._state.fail(error);
            });
        });
    }

    private _update() {
        this.search(Toolkit.guid()).then(() => {
            OutputParsersService.setHighlights(this.getGuid(), this._storage.get());
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

    private _ipc_onSearchUpdated(message: IPCMessages.SearchUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        this._output.updateStreamState(message.rowsCount);
    }

}
