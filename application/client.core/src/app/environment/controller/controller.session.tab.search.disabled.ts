import { Observable, Subject, Subscription } from 'rxjs';
import { Importable } from './controller.session.importer.interface';
import {
    DisabledRequest,
    DisabledStorage,
    IUpdateEvent,
    IDisabledDesc,
} from './controller.session.tab.search.disabled.storage';

import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export { DisabledRequest, DisabledStorage, IUpdateEvent };

export interface IControllerSessionStreamDisabled {
    guid: string;
}

export class ControllerSessionTabSearchDisabled extends Importable<IDisabledDesc[]> {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: DisabledStorage;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };
    private _subjects: {
        onExport: Subject<void>,
    } = {
        onExport: new Subject<void>(),
    };

    constructor(params: IControllerSessionStreamDisabled) {
        super();
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchDisabled: ${params.guid}`);
        this._storage = new DisabledStorage(params.guid);
        this._subscriptions.updated = this._storage.getObservable().updated.subscribe(this._onStorageUpdated.bind(this));
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
            this._storage.store().upload(disableds);
            resolve();
        });
    }

    private _onStorageUpdated() {
        this._subjects.onExport.next();
    }

}
