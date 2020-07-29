import { Observable, Subject } from 'rxjs';
import { DisabledRequest } from './controller.session.tab.search.disabled.request';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IUpdateEvent {
    requests: DisabledRequest[];
    added?: DisabledRequest | DisabledRequest[];
    removed?: DisabledRequest;
}

export interface IReorderParams {
    prev: number;
    curt: number;
}

export { DisabledRequest };

export class DisabledStorage {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _stored: DisabledRequest[] = [];
    private _subjects: {
        updated: Subject<IUpdateEvent>,
    } = {
        updated: new Subject<IUpdateEvent>(),
    };

    constructor(session: string) {
        this._guid = session;
        this._logger = new Toolkit.Logger(`DisabledStorage: ${session}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._clear();
            resolve();
        });
    }

    public getObservable(): {
        updated: Observable<IUpdateEvent>,
    } {
        return {
            updated: this._subjects.updated.asObservable(),
        };
    }

    public has(request: DisabledRequest): boolean {
        return this._stored.find((stored: DisabledRequest) => {
            return request.getGUID() === stored.getGUID();
        }) !== undefined;
    }

    public add(descs: DisabledRequest | Array<DisabledRequest>): Error {
        if (!(descs instanceof Array)) {
            descs = [descs];
        }
        const prevCount: number = this._stored.length;
        const added: DisabledRequest[] = [];
        try {
            descs.forEach((request: DisabledRequest) => {
                // Add request
                this._stored.push(request);
                added.push(request);
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

    public remove(request: DisabledRequest) {
        const prevCount: number = this._stored.length;
        // Remove request from storage
        this._stored = this._stored.filter((stored: DisabledRequest) => {
            return request.getGUID() !== stored.getGUID();
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

    public get(): DisabledRequest[] {
        return this._stored;
    }

    public reorder(params: IReorderParams) {
        const request: DisabledRequest = this._stored[params.prev];
        this._stored = this._stored.filter((i: DisabledRequest, index: number) => {
            return index !== params.prev;
        });
        this._stored.splice(params.curt, 0, request);
        this._subjects.updated.next({ requests: this._stored });
    }

    private _clear() {
        // Destroy requests
        this._stored.forEach((request: DisabledRequest) => {
            request.destroy();
        });
        // Remove from storage
        this._stored = [];
    }

}
