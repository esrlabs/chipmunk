import { Observable, Subject } from 'rxjs';
import {
    ChartRequest,
    IChartUpdateEvent,
    IFlags as IChartFlags,
    IDesc as IChartDesc,
    IDescOptional as IChartDescOptional,
    IDescUpdating as IChartDescUpdating,
} from './controller.session.tab.search.charts.request';
import {
    IStore,
    EStoreKeys,
    IStoreData,
} from '../../dependencies/store/controller.session.tab.search.store.support';
import { SessionGetter } from '../search.dependency';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IUpdateEvent {
    requests: ChartRequest[];
    updated?: ChartRequest;
    added?: ChartRequest | ChartRequest[];
    removed?: ChartRequest;
}

export interface IReorderParams {
    prev: number;
    curt: number;
}

export {
    ChartRequest,
    IChartUpdateEvent,
    IUpdateEvent as IChartsStorageUpdated,
    IChartFlags,
    IChartDesc,
    IChartDescOptional,
    IChartDescUpdating,
};

export class ChartsStorage implements IStore<IChartDesc[]> {
    private readonly _logger: Toolkit.Logger;
    private readonly _guid: string;
    private readonly _subjects: {
        updated: Subject<IUpdateEvent>;
        changed: Subject<IChartUpdateEvent>;
    } = {
        updated: new Subject<IUpdateEvent>(),
        changed: new Subject<IChartUpdateEvent>(),
    };
    private readonly _session: SessionGetter;
    private _stored: ChartRequest[] = [];

    constructor(guid: string, session: SessionGetter) {
        this._guid = guid;
        this._session = session;
        this._logger = new Toolkit.Logger(`ChartsStorage: ${guid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._clear();
            resolve();
        });
    }

    public getObservable(): {
        updated: Observable<IUpdateEvent>;
        changed: Observable<IChartUpdateEvent>;
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            changed: this._subjects.changed.asObservable(),
        };
    }

    public has(request: ChartRequest): boolean {
        return (
            this._stored.find((stored: ChartRequest) => {
                return request.getHash() === stored.getHash();
            }) !== undefined
        );
    }

    public add(
        descs: IChartDescOptional | ChartRequest | Array<IChartDescOptional | ChartRequest>,
        from?: number,
    ): Error | undefined {
        if (!(descs instanceof Array)) {
            descs = [descs];
        }
        const prevCount: number = this._stored.length;
        const added: ChartRequest[] = [];
        try {
            descs.forEach((desc: IChartDescOptional | ChartRequest) => {
                // Create search request
                const srchRqst: ChartRequest =
                    desc instanceof ChartRequest
                        ? new ChartRequest(desc.asDesc())
                        : new ChartRequest(desc);
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
                added.push(srchRqst),
                    // Subscribe on update event
                    srchRqst.onUpdated(this._onRequestUpdated.bind(this));
            });
        } catch (err) {
            return new Error(
                `Fail add request(s) due error: ${err instanceof Error ? err.message : err}`,
            );
        }
        if (this._stored.length === prevCount) {
            return;
        }
        this._subjects.updated.next({
            requests: this._stored,
            added: added.length === 1 ? added[0] : added,
        });
        if (this._stored.length > 0) {
            const api = this._session().getAPI();
            api.openToolbarApp(api.getDefaultToolbarAppsIds().charts, true);
        }
        return undefined;
    }

    public remove(request: ChartRequest) {
        const prevCount: number = this._stored.length;
        // Remove request from storage
        this._stored = this._stored.filter((stored: ChartRequest) => {
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

    public get(): ChartRequest[] {
        return this._stored;
    }

    public getStoredCount(): number {
        return this._stored.length;
    }

    public getAsDesc(): IChartDescOptional[] {
        return this._stored.map((c) => c.asDesc());
    }

    public getActive(): ChartRequest[] {
        return this._stored.filter((request: ChartRequest) => request.getState());
    }

    public reorder(params: IReorderParams) {
        const filter: ChartRequest = this._stored[params.prev];
        this._stored = this._stored.filter((i: ChartRequest, index: number) => {
            return index !== params.prev;
        });
        this._stored.splice(params.curt, 0, filter);
        this._subjects.updated.next({ requests: this._stored, updated: undefined });
    }

    public getBySource(source: string): ChartRequest | undefined {
        return this._stored.find((chart: ChartRequest) => {
            return chart.asRegExp().source === source;
        });
    }

    public store(): {
        key(): EStoreKeys;
        extract(): IStoreData;
        upload(charts: IChartDesc[], append: boolean): Error | undefined;
        getItemsCount(): number;
    } {
        const self = this;
        return {
            key() {
                return EStoreKeys.charts;
            },
            extract() {
                return self._stored.map((chart: ChartRequest) => {
                    return chart.asDesc();
                });
            },
            upload(charts: IChartDesc[], append: boolean) {
                if (!append) {
                    self.clear();
                }
                return self.add(charts.map((desc: IChartDesc) => new ChartRequest(desc)));
            },
            getItemsCount(): number {
                return self._stored.length;
            },
        };
    }

    private _onRequestUpdated(event: IChartUpdateEvent) {
        this._subjects.changed.next(event);
    }

    private _clear() {
        // Destroy requests
        this._stored.forEach((request: ChartRequest) => {
            request.destroy();
        });
        // Remove from storage
        this._stored = [];
    }
}
