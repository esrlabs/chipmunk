import { Observable, Subject } from 'rxjs';
import {
    FilterRequest,
    IFilterUpdateEvent,
    IFlags as IFilterFlags,
    IDesc as IFilterDesc,
    IDescOptional as IFilterDescOptional,
    IDescUpdating as IFilterDescUpdating,
} from './controller.session.tab.search.filters.request';
import {
    IStore,
    EStoreKeys,
    IStoreData,
} from '../../dependencies/store/controller.session.tab.search.store.support';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IUpdateEvent {
    requests: FilterRequest[];
    updated?: FilterRequest;
    added?: FilterRequest | FilterRequest[];
    removed?: FilterRequest;
}

export interface IReorderParams {
    prev: number;
    curt: number;
}

export {
    FilterRequest,
    IUpdateEvent as IFiltersStorageUpdated,
    IFilterUpdateEvent,
    IFilterFlags,
    IFilterDesc,
    IFilterDescOptional,
    IFilterDescUpdating,
};

export class FiltersStorage implements IStore<IFilterDesc[]> {
    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stored: FilterRequest[] = [];
    private _subjects: {
        updated: Subject<IUpdateEvent>;
        changed: Subject<IFilterUpdateEvent>;
    } = {
        updated: new Subject<IUpdateEvent>(),
        changed: new Subject<IFilterUpdateEvent>(),
    };

    constructor(session: string) {
        this._guid = session;
        this._logger = new Toolkit.Logger(`FiltersStorage: ${session}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._clear();
            resolve();
        });
    }

    public getObservable(): {
        updated: Observable<IUpdateEvent>;
        changed: Observable<IFilterUpdateEvent>;
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            changed: this._subjects.changed.asObservable(),
        };
    }

    public has(request: FilterRequest): boolean {
        return (
            this._stored.find((stored: FilterRequest) => {
                return request.getHash() === stored.getHash();
            }) !== undefined
        );
    }

    public add(
        descs: IFilterDescOptional | FilterRequest | Array<IFilterDescOptional | FilterRequest>,
        from?: number,
    ): Error | undefined {
        if (!(descs instanceof Array)) {
            descs = [descs];
        }
        const prevCount: number = this._stored.length;
        const added: FilterRequest[] = [];
        try {
            descs.forEach((desc: IFilterDescOptional | FilterRequest) => {
                // Create search request
                const srchRqst: FilterRequest =
                    desc instanceof FilterRequest
                        ? new FilterRequest(desc.asDesc())
                        : new FilterRequest(desc);
                // Check request
                if (this.has(srchRqst)) {
                    this._logger.warn(`Request "${srchRqst.asDesc().request}" already exist`);
                    return;
                }
                // Add request
                if (typeof from === 'number' && from < this._stored.length) {
                    this._stored.splice(from, 0, srchRqst);
                } else {
                    this._stored.push(srchRqst);
                }
                added.push(srchRqst);
                // Subscribe on update event
                srchRqst.onUpdated(this._onRequestUpdated.bind(this));
            });
        } catch (err) {
            return new Error(
                `Fail add request(s) due error: ${err instanceof Error ? err.message : err}`,
            );
        }
        if (this._stored.length === prevCount) {
            return undefined;
        }
        this._subjects.updated.next({
            requests: this._stored,
            added: added.length === 1 ? added[0] : added,
        });
        return undefined;
    }

    public remove(request: FilterRequest) {
        const prevCount: number = this._stored.length;
        // Remove request from storage
        this._stored = this._stored.filter((stored: FilterRequest) => {
            return request.getHash() !== stored.getHash();
        });
        // Destroy request
        request.destroy();
        // Emit event if it's needed
        if (this._stored.length === prevCount) {
            return;
        }
        this._subjects.updated.next({ requests: this._stored, removed: request });
    }

    public clear() {
        if (this._stored.length === 0) {
            return;
        }
        // Clear
        this._clear();
        // Emit event if it's needed
        this._subjects.updated.next({ requests: this._stored });
    }

    public get(): FilterRequest[] {
        return this._stored;
    }

    public getStoredCount(): number {
        return this._stored.length;
    }

    public getAsDesc(): IFilterDescOptional[] {
        return this._stored.map((filter: FilterRequest) => {
            return filter.asDesc();
        });
    }

    public getActive(): FilterRequest[] {
        return this._stored.filter((request: FilterRequest) => request.getState());
    }

    public reorder(params: IReorderParams) {
        const filter: FilterRequest = this._stored[params.prev];
        this._stored = this._stored.filter((i: FilterRequest, index: number) => {
            return index !== params.prev;
        });
        this._stored.splice(params.curt, 0, filter);
        this._subjects.updated.next({ requests: this._stored, updated: undefined });
    }

    public getBySource(source: string): FilterRequest | undefined {
        return this._stored.find((filter: FilterRequest) => {
            return filter.asRegExp().source === source;
        });
    }

    public store(): {
        key(): EStoreKeys;
        extract(): IStoreData;
        upload(filters: IFilterDesc[], append: boolean): Error | undefined;
        getItemsCount(): number;
    } {
        const self = this;
        return {
            key() {
                return EStoreKeys.filters;
            },
            extract() {
                return self._stored.map((filter: FilterRequest) => {
                    return filter.asDesc();
                });
            },
            upload(filters: IFilterDesc[], append: boolean) {
                if (!append) {
                    self.clear();
                }
                return self.add(filters.map((desc: IFilterDesc) => new FilterRequest(desc)));
            },
            getItemsCount(): number {
                return self._stored.length;
            },
        };
    }

    private _onRequestUpdated(event: IFilterUpdateEvent) {
        this._subjects.changed.next(event);
    }

    private _clear() {
        // Destroy requests
        this._stored.forEach((request: FilterRequest) => {
            request.destroy();
        });
        // Remove from storage
        this._stored = [];
    }
}
