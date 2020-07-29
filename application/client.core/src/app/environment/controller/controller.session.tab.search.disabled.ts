import { Observable, Subject, Subscription } from 'rxjs';
import {
    DisabledRequest,
    DisabledStorage,
    IUpdateEvent,
} from './controller.session.tab.search.disabled.storage';

import ServiceElectronIpc, { IPCMessages } from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export { DisabledRequest, DisabledStorage, IUpdateEvent };

export interface IControllerSessionStreamDisabled {
    guid: string;
}

export class ControllerSessionTabSearchDisabled {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: DisabledStorage;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };

    constructor(params: IControllerSessionStreamDisabled) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchDisabled: ${params.guid}`);
        this._storage = new DisabledStorage(params.guid);
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

}
