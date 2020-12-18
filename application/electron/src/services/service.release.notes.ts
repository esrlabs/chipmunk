// tslint:disable: max-classes-per-file

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { IPCMessages } from './service.electron';

import ServicePackage from './service.package';
import ServiceElectron from './service.electron';
import Logger from '../tools/env.logger';
import ServiceRenderState from './service.render.state';

import * as Tools from '../tools/index';

interface IStore {
    version: string;
}

/**
 * @class ServiceReleaseNotes
 * @description Check current release to show notes
 */

class ServiceReleaseNotes implements IService {

    private readonly _filename: string = 'release.notes.json';
    private _logger: Logger = new Logger('ServiceReleaseNotes');
    private _store: StateFile<IStore> | undefined;
    private _subscriptions: { [key: string]: Tools.Subscription } = {};

    public init(): Promise<void> {
        return new Promise((resolve) => {
            ServiceRenderState.doOnReady(Tools.guid(), () => {
                this._store = new StateFile<IStore>(this.getName(), this._getDefaults(), this._filename);
                this._store.init().then(() => {
                    if (this._store === undefined) {
                        return;
                    }
                    if (this._store.get().version === ServicePackage.get().version) {
                        return;
                    }
                    ServiceElectron.IPC.send(new IPCMessages.TabCustomVersion({version: ServicePackage.get().version})).catch((error: Error) => {
                        this._logger.warn(`Fail to send TabCustomVersion due error: ${error.message}`);
                    });
                    ServiceElectron.IPC.send(new IPCMessages.TabCustomRelease()).then(() => {
                        if (this._store === undefined) {
                            return;
                        }
                        this._store.set({
                            version: ServicePackage.get().version,
                        }).then(() => {
                            resolve();
                        }).catch((err: Error) => {
                            this._logger.error(err.message);
                        });
                    }).catch((error: Error) => {
                        this._logger.warn(`Fail to send TabCustomRelease due error: ${error.message}`);
                    });
                }).catch(() => {
                    this._store = undefined;
                });
            });
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceReleaseNotes';
    }

    private _getDefaults(): IStore {
        return {
            version: '',
        };
    }

}

export default (new ServiceReleaseNotes());
