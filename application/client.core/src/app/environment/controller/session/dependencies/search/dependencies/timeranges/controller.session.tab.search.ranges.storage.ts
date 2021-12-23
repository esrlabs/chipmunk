import { Observable, Subject } from 'rxjs';
import {
    RangeRequest,
    IRangeUpdateEvent,
    IDesc as IRangeDesc,
    IDescOptional as IRangeDescOptional,
    IDescUpdating as IRangeDescUpdating,
} from './controller.session.tab.search.ranges.request';
import {
    IStore,
    EStoreKeys,
    IStoreData,
} from '../../dependencies/store/controller.session.tab.search.store.support';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IUpdateEvent {
    ranges: RangeRequest[];
    updated?: RangeRequest;
    added?: RangeRequest | RangeRequest[];
    removed?: RangeRequest;
}

export interface IReorderParams {
    prev: number;
    curt: number;
}

export {
    RangeRequest,
    IUpdateEvent as IRangesStorageUpdated,
    IRangeUpdateEvent,
    IRangeDesc,
    IRangeDescOptional,
    IRangeDescUpdating,
};

export class RangesStorage implements IStore<IRangeDesc[]> {
    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stored: RangeRequest[] = [];
    private _subjects: {
        updated: Subject<IUpdateEvent>;
        changed: Subject<IRangeUpdateEvent>;
    } = {
        updated: new Subject<IUpdateEvent>(),
        changed: new Subject<IRangeUpdateEvent>(),
    };

    constructor(session: string) {
        this._guid = session;
        this._logger = new Toolkit.Logger(`RangesStorage: ${session}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._clear();
            resolve();
        });
    }

    public getObservable(): {
        updated: Observable<IUpdateEvent>;
        changed: Observable<IRangeUpdateEvent>;
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            changed: this._subjects.changed.asObservable(),
        };
    }

    public has(request: RangeRequest): boolean {
        return (
            this._stored.find((stored: RangeRequest) => {
                return request.getGUID() === stored.getGUID();
            }) !== undefined
        );
    }

    public add(
        descs: IRangeDescOptional | RangeRequest | Array<IRangeDescOptional | RangeRequest>,
        from?: number,
    ): Error | undefined {
        if (!(descs instanceof Array)) {
            descs = [descs];
        }
        const prevCount: number = this._stored.length;
        const added: RangeRequest[] = [];
        try {
            descs.forEach((desc: IRangeDescOptional | RangeRequest) => {
                // Create search request
                const range: RangeRequest =
                    desc instanceof RangeRequest ? desc : new RangeRequest(desc);
                // Check request
                if (this.has(range)) {
                    this._logger.warn(`Range already exist`);
                    return;
                }
                // Add request
                if (typeof from === 'number' && from < this._stored.length) {
                    this._stored.splice(from, 0, range);
                } else {
                    this._stored.push(range);
                }
                added.push(range);
                // Subscribe on update event
                range.onUpdated(this._onRequestUpdated.bind(this));
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
            ranges: this._stored,
            added: added.length === 1 ? added[0] : added,
        });
        return undefined;
    }

    public remove(range: RangeRequest) {
        const prevCount: number = this._stored.length;
        // Remove request from storage
        this._stored = this._stored.filter((stored: RangeRequest) => {
            return range.getGUID() !== stored.getGUID();
        });
        // Destroy request
        range.destroy();
        // Emit event if it's needed
        if (this._stored.length === prevCount) {
            return;
        }
        this._subjects.updated.next({ ranges: this._stored, removed: range });
    }

    public clear() {
        if (this._stored.length === 0) {
            return;
        }
        // Clear
        this._clear();
        // Emit event if it's needed
        this._subjects.updated.next({ ranges: this._stored });
    }

    public get(): RangeRequest[] {
        return this._stored;
    }

    public getStoredCount(): number {
        return this._stored.length;
    }

    public getAsDesc(): IRangeDescOptional[] {
        return this._stored.map((r) => r.asDesc());
    }

    public reorder(params: IReorderParams) {
        const filter: RangeRequest = this._stored[params.prev];
        this._stored = this._stored.filter((i: RangeRequest, index: number) => {
            return index !== params.prev;
        });
        this._stored.splice(params.curt, 0, filter);
        this._subjects.updated.next({ ranges: this._stored, updated: undefined });
    }

    public store(): {
        key(): EStoreKeys;
        extract(): IStoreData;
        upload(ranges: IRangeDesc[], append: boolean): Error | undefined;
        getItemsCount(): number;
    } {
        const self = this;
        return {
            key() {
                return EStoreKeys.ranges;
            },
            extract() {
                return self._stored.map((range: RangeRequest) => {
                    return range.asDesc();
                });
            },
            upload(ranges: IRangeDesc[], append: boolean): Error | undefined {
                if (!append) {
                    self.clear();
                }
                return self.add(ranges.map((desc: IRangeDesc) => new RangeRequest(desc)));
            },
            getItemsCount(): number {
                return self._stored.length;
            },
        };
    }

    private _onRequestUpdated(event: IRangeUpdateEvent) {
        this._subjects.changed.next(event);
    }

    private _clear() {
        // Destroy requests
        this._stored.forEach((request: RangeRequest) => {
            request.destroy();
        });
        // Remove from storage
        this._stored = [];
    }
}
