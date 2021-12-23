import { Observable, Subject, Subscription } from 'rxjs';
import { Importable } from '../../../importer/controller.session.importer.interface';
import {
    FilterRequest,
    IFilterFlags,
    IFiltersStorageUpdated,
    IFilterUpdateEvent,
    FiltersStorage,
    IFilterDescOptional,
} from './controller.session.tab.search.filters.storage';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';
import { IPC } from '../../../../../../services/service.electron.ipc';

import ServiceElectronIpc from '../../../../../../services/service.electron.ipc';
import OutputParsersService from '../../../../../../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export { FilterRequest, IFilterFlags, FiltersStorage };

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
    onExport: Subject<void>;
}

export class ControllerSessionTabSearchFilters
    extends Importable<IFilterDescOptional[]>
    implements Dependency
{
    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage!: FiltersStorage;
    private _subjects: ISubjects = {
        updated: new Subject<FiltersStorage>(),
        searching: new Subject<void>(),
        complited: new Subject<void>(),
        dropped: new Subject<void>(),
        onExport: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };
    private _single: boolean = false;

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        super();
        this._guid = uuid;
        this._accessor = {
            session,
            search,
        };
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchFilters: ${uuid}`);
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage = new FiltersStorage(this._guid);
            this._subscriptions.SearchUpdated = ServiceElectronIpc.subscribe(
                IPC.SearchUpdated,
                this._ipc_onSearchUpdated.bind(this),
            );
            this._subscriptions.onStorageUpdated = this._storage
                .getObservable()
                .updated.subscribe(this._onStorageUpdated.bind(this));
            this._subscriptions.onStorageChanged = this._storage
                .getObservable()
                .changed.subscribe(this._onStorageChanged.bind(this));
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // TODO: Cancelation of current
            this._storage.destroy().then(() => {
                OutputParsersService.unsetSearchResults(this._guid);
                resolve();
            });
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
        });
    }

    public getName(): string {
        return 'ControllerSessionTabSearchFilters';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        updated: Observable<FiltersStorage>;
        searching: Observable<void>;
        complited: Observable<void>;
        dropped: Observable<void>;
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            searching: this._subjects.searching.asObservable(),
            complited: this._subjects.complited.asObservable(),
            dropped: this._subjects.dropped.asObservable(),
        };
    }

    public search(
        requestId: string,
        requests?: FilterRequest | FilterRequest[],
    ): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            let _requests: FilterRequest[] = [];
            this._single = false;
            if (requests === undefined) {
                _requests = this._storage.getActive();
            } else if (!(requests instanceof Array)) {
                this._single = true;
                _requests = [requests];
            } else {
                _requests = requests;
            }
            this._accessor
                .search()
                .getQueue()
                .add(requestId, () => {
                    return new Promise((done, fail) => {
                        this._subjects.searching.next();
                        // Drop output
                        this._accessor.search().getOutputStream().clearStream();
                        // Start search
                        ServiceElectronIpc.request<IPC.SearchRequestResults>(
                            new IPC.SearchRequest({
                                requests: _requests.map((reg) => reg.asIPC()),
                                session: this._guid,
                                id: requestId,
                            }),
                            IPC.SearchRequestResults,
                        )
                            .then((results) => {
                                this._subjects.complited.next();
                                this._logger.env(
                                    `Search request ${results.requestId} was finished in ${(
                                        results.duration / 1000
                                    ).toFixed(2)}s.`,
                                );
                                if (results.error !== undefined) {
                                    // Some error during processing search request
                                    this._logger.error(
                                        `Search request id ${results.requestId} was finished with error: ${results.error}`,
                                    );
                                    reject(new Error(results.error));
                                    return fail(new Error(results.error));
                                }
                                // Share results
                                OutputParsersService.setSearchResults(this._guid, _requests);
                                // Update stream for render
                                this._accessor
                                    .search()
                                    .getOutputStream()
                                    .updateStreamState(results.found);
                                // Resolve request
                                resolve(results.found);
                                // Resolve task
                                done();
                            })
                            .catch((error: Error) => {
                                this._subjects.complited.next();
                                reject(error);
                                fail(error);
                            });
                    });
                });
        });
    }

    public drop(requestId: string): Promise<number | undefined> {
        return new Promise((resolve, reject) => {
            // Waiting for already started operations
            this._accessor
                .search()
                .getQueue()
                .add(requestId, () => {
                    return new Promise((done, fail) => {
                        // Drop output
                        this._accessor.search().getOutputStream().clearStream();
                        // Trigger event
                        this._subjects.dropped.next();
                        // Start search
                        ServiceElectronIpc.request<IPC.SearchRequestResults>(
                            new IPC.SearchRequest({
                                requests: [],
                                session: this._guid,
                                id: requestId,
                            }),
                            IPC.SearchRequestResults,
                        )
                            .then((results) => {
                                this._logger.env(
                                    `Search request ${results.requestId} was finished in ${(
                                        results.duration / 1000
                                    ).toFixed(2)}s.`,
                                );
                                if (results.error !== undefined) {
                                    // Some error during processing search request
                                    this._logger.error(
                                        `Search request id ${results.requestId} was finished with error: ${results.error}`,
                                    );
                                    reject(new Error(results.error));
                                    return fail(new Error(results.error));
                                }
                                // Share results
                                OutputParsersService.setSearchResults(this._guid, []);
                                // Update stream for render
                                this._accessor.search().getOutputStream().updateStreamState(0);
                                // Resolve request
                                resolve(0);
                                // Resolve task
                                done();
                                // Aplly filters if exsists
                                this._update();
                            })
                            .catch((error: Error) => {
                                fail(error);
                            })
                            .finally(() => {
                                // Emit event
                                this._accessor
                                    .session()
                                    .getScope()
                                    .getSessionEventsHub()
                                    .emit()
                                    .onSearchUpdated({ rows: 0, session: this._guid });
                            });
                    });
                });
        });
    }

    public getStorage(): FiltersStorage {
        return this._storage;
    }

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'filters';
    }

    public export(): Promise<IFilterDescOptional[] | undefined> {
        return new Promise((resolve) => {
            if (this._storage.get().length === 0) {
                return resolve(undefined);
            }
            resolve(this._storage.getAsDesc());
        });
    }

    public import(filters: IFilterDescOptional[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const err: Error | undefined = this._storage.add(filters);
            if (err instanceof Error) {
                reject(err);
            } else {
                resolve();
            }
        });
    }

    public isSingle(): boolean {
        return this._single;
    }

    private _onStorageUpdated(event: IFiltersStorageUpdated | undefined) {
        OutputParsersService.setHighlights(this.getGuid(), this.getStorage().get());
        OutputParsersService.updateRowsView();
        this._subjects.updated.next(this._storage);
        this._subjects.onExport.next();
        if (this._accessor.search().getQueue().isLocked()) {
            // Do not apply search, because we have active search
            return;
        }
        if (this._storage.getActive().length === 0) {
            this.drop(Toolkit.guid()).catch((error: Error) => {
                this._logger.error(
                    `Fail to drop search results of stored filters due error: ${error.message}`,
                );
            });
        } else {
            this._update();
        }
    }

    private _onStorageChanged(event: IFilterUpdateEvent) {
        if (event.updated.state || event.updated.request) {
            this._onStorageUpdated(undefined);
        } else {
            OutputParsersService.setHighlights(this.getGuid(), this.getStorage().get());
            OutputParsersService.updateRowsView();
        }
        this._subjects.onExport.next();
    }

    private _update() {
        this.search(Toolkit.guid())
            .then(() => {
                OutputParsersService.setHighlights(this.getGuid(), this._storage.get());
                OutputParsersService.updateRowsView();
            })
            .catch((error: Error) => {
                this._logger.error(`Cannot apply filters due error: ${error.message}`);
            });
    }

    private _ipc_onSearchUpdated(message: IPC.SearchUpdated) {
        if (this._guid !== message.guid) {
            return;
        }
        this._accessor.search().getOutputStream().updateStreamState(message.rowsCount);
    }
}
