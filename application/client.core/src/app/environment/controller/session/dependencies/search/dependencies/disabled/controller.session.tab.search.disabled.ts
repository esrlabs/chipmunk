import { Observable, Subject, Subscription } from 'rxjs';
import { Importable } from '../../../importer/controller.session.importer.interface';
import {
    DisabledRequest,
    DisabledStorage,
    IUpdateEvent,
    IDisabledDesc,
} from './controller.session.tab.search.disabled.storage';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

import * as Toolkit from 'chipmunk.client.toolkit';

export { DisabledRequest, DisabledStorage, IUpdateEvent };

export interface IControllerSessionStreamDisabled {
    guid: string;
}

export class ControllerSessionTabSearchDisabled
    extends Importable<IDisabledDesc[]>
    implements Dependency
{
    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage!: DisabledStorage;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _subjects: {
        onExport: Subject<void>;
    } = {
        onExport: new Subject<void>(),
    };
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        super();
        this._guid = uuid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchDisabled: ${uuid}`);
        this._accessor = {
            session,
            search,
        };
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage = new DisabledStorage(this._guid);
            this._subscriptions.updated = this._storage
                .getObservable()
                .updated.subscribe(this._onStorageUpdated.bind(this));
            resolve();
        });
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

    public getName(): string {
        return 'ControllerSessionTabSearchDisabled';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getStorage(): DisabledStorage {
        return this._storage;
    }

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'disabled';
    }

    public export(): Promise<IDisabledDesc[] | undefined> {
        return new Promise((resolve) => {
            if (this._storage.get().length === 0) {
                return resolve(undefined);
            }
            resolve(this._storage.getAsDesc());
        });
    }

    public import(disableds: IDisabledDesc[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage.clear();
            const err: Error | undefined = this._storage.store().upload(disableds, false);
            if (err instanceof Error) {
                reject(err);
            } else {
                resolve();
            }
        });
    }

    private _onStorageUpdated() {
        this._subjects.onExport.next();
    }
}
