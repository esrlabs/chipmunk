import { Observable, Subject } from 'rxjs';
import {
    ChartRequest,
    IFlags as IChartFlags,
    IDesc as IChartDesc,
    IDescOptional as IChartDescOptional,
    IDescUpdating as IChartDescUpdating,
} from './controller.session.tab.search.charts.request';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IUpdateEvent {
    requests: ChartRequest[];
    updated?: ChartRequest;
    added?: ChartRequest | ChartRequest[];
    removed?: ChartRequest;
}

interface IChangeEvent {
    request: ChartRequest;
    reapply: boolean;
}

export interface IReorderParams {
    prev: number;
    curt: number;
}

export {
    ChartRequest,
    IChangeEvent as IChartsChangeEvent,
    IUpdateEvent as IChartsStorageUpdated,
    IChartFlags,
    IChartDesc,
    IChartDescOptional,
    IChartDescUpdating
};

export class ChartsStorage {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stored: ChartRequest[] = [];
    private _subjects: {
        updated: Subject<IUpdateEvent>,
        changed: Subject<IChangeEvent>,
    } = {
        updated: new Subject<IUpdateEvent>(),
        changed: new Subject<IChangeEvent>(),
    };

    constructor(session: string) {
        this._guid = session;
        this._logger = new Toolkit.Logger(`ChartsStorage: ${session}`);
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

    public has(request: ChartRequest): boolean {
        return this._stored.find((stored: ChartRequest) => {
            return request.getHash() === stored.getHash();
        }) !== undefined;
    }

    public add(descs: IChartDescOptional | ChartRequest | Array<IChartDescOptional | ChartRequest>): Error {
        if (!(descs instanceof Array)) {
            descs = [descs];
        }
        const prevCount: number = this._stored.length;
        const added: ChartRequest[] = [];
        try {
            descs.forEach((desc: IChartDescOptional | ChartRequest) => {
                    // Create search request
                    const srchRqst: ChartRequest = desc instanceof ChartRequest ? desc : new ChartRequest(desc);
                    // Subscribe on update event
                    srchRqst.onUpdated(this._onRequestUpdated.bind(this));
                    // Check request
                    if (this.has(srchRqst)) {
                        throw new Error(`Request "${srchRqst.asDesc().request}" already exist`);
                    }
                    // Add request
                    this._stored.push(srchRqst);
                    added.push(srchRqst),
                    // Listent request
                    srchRqst.onChanged((request: ChartRequest) => {
                        this._subjects.changed.next({
                            request: request,
                            reapply: false,
                        });
                    });
                    srchRqst.onUpdated((request: ChartRequest) => {
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
        this._subjects.updated.next({ requests: this._stored, added: added.length === 1 ? added[0] : added });
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

    private _onRequestUpdated(request: ChartRequest) {
        this._subjects.updated.next({ requests: this._stored, updated: request });
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
