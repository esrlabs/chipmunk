import { Observable, Subject } from 'rxjs';
import {
    FilterRequest,
    IFlags as IFilterFlags,
    IDesc as IFilterDesc,
    IDescOptional as IFilterDescOptional,
    IDescUpdating as IFilterDescUpdating,
} from './controller.session.tab.search.filters.request';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IUpdateEvent {
    requests: FilterRequest[];
    updated?: FilterRequest;
}

interface IChangeEvent {
    request: FilterRequest;
    reapply: boolean;
}

export interface IReorderParams {
    prev: number;
    curt: number;
}

export {
    FilterRequest,
    IUpdateEvent as IFiltersStorageUpdated,
    IChangeEvent as IFiltersChangeEvent,
    IFilterFlags,
    IFilterDesc,
    IFilterDescOptional,
    IFilterDescUpdating
};

export class FiltersStorage {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stored: FilterRequest[] = [];
    private _subjects: {
        updated: Subject<IUpdateEvent>,
        changed: Subject<IChangeEvent>
    } = {
        updated: new Subject<IUpdateEvent>(),
        changed: new Subject<IChangeEvent>(),
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
        updated: Observable<IUpdateEvent>,
        changed: Observable<IChangeEvent>,
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            changed: this._subjects.changed.asObservable(),
        };
    }

    public has(request: FilterRequest): boolean {
        return this._stored.find((stored: FilterRequest) => {
            return request.getHash() === stored.getHash();
        }) !== undefined;
    }

    public add(descs: IFilterDescOptional | FilterRequest | Array<IFilterDescOptional | FilterRequest>): Error {
        if (!(descs instanceof Array)) {
            descs = [descs];
        }
        const prevCount: number = this._stored.length;
        try {
            descs.forEach((desc: IFilterDescOptional | FilterRequest) => {
                    // Create search request
                    const srchRqst: FilterRequest = desc instanceof FilterRequest ? desc : new FilterRequest(desc);
                    // Subscribe on update event
                    srchRqst.onUpdated(this._onRequestUpdated.bind(this));
                    // Check request
                    if (this.has(srchRqst)) {
                        throw new Error(`Request "${srchRqst.asDesc().request}" already exist`);
                    }
                    // Add request
                    this._stored.push(srchRqst);
                    // Listent request
                    srchRqst.onChanged((request: FilterRequest) => {
                        this._subjects.changed.next({
                            request: request,
                            reapply: false,
                        });
                    });
                    srchRqst.onUpdated((request: FilterRequest) => {
                        this._subjects.changed.next({
                            request: request,
                            reapply: true,
                        });
                    });
            });
        } catch (err) {
            return new Error(`Fail add request(s) due error: ${err.message}`);
        }
        if (this._stored.length === prevCount) {
            return;
        }
        this._subjects.updated.next({ requests: this._stored });
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
        this._subjects.updated.next({ requests: this._stored });
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

    private _onRequestUpdated(request: FilterRequest) {
        this._subjects.updated.next({ requests: this._stored, updated: request });
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
