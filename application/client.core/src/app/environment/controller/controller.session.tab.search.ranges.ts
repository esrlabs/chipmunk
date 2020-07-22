import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabTimestamp } from './controller.session.tab.timestamps';
import {
    RangeRequest,
    RangesStorage,
    IRangeUpdateEvent,
    IRangesStorageUpdated,
    IUpdateEvent,
} from './controller.session.tab.search.ranges.storage';

import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export { RangeRequest, RangesStorage };

export interface IControllerSessionStreamFilters {
    guid: string;
}

export interface ISearchOptions {
    requestId: string;
    requests: RegExp[];
    filters?: boolean;
    cancelPrev?: boolean;
}

export interface ISubjects {
    updated: Subject<RangesStorage>;
    searching: Subject<void>;
    complited: Subject<void>;
    dropped: Subject<void>;
}

export class ControllerSessionTabSearchRanges {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: RangesStorage;
    private _subjects: ISubjects = {
        updated: new Subject<RangesStorage>(),
        searching: new Subject<void>(),
        complited: new Subject<void>(),
        dropped: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };

    constructor(params: IControllerSessionStreamFilters) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchRanges: ${params.guid}`);
        this._storage = new RangesStorage(params.guid);
        this._subscriptions.onStorageUpdated = this._storage.getObservable().updated.subscribe(this._onStorageUpdated.bind(this));
        this._subscriptions.onStorageChanged = this._storage.getObservable().changed.subscribe(this._onStorageChanged.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // TODO: Cancelation of current
            this._storage.destroy().then(() => {
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

    public getObservable(): {
        updated: Observable<RangesStorage>,
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


    public getStorage(): RangesStorage {
        return this._storage;
    }

    private _onStorageUpdated(event: IRangesStorageUpdated | undefined) {
    }

    private _onStorageChanged(event: IRangeUpdateEvent) {

    }

}
