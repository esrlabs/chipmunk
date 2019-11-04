import * as IScheme from './service.storage.scheme';

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import Logger from '../tools/env.logger';

export { IScheme as IStorageScheme };

const SETTINGS_FILE = 'storage.application.json';

/**
 * @class ServiceStorage
 * @description Provides access to logviewer configuration. Used on electron level
 */

class ServiceStorage implements IService {

    private _settings: StateFile<IScheme.IStorage> | undefined;
    private _logger: Logger = new Logger('ServiceFileOpener');

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._settings = new StateFile<IScheme.IStorage>(this.getName(), IScheme.defaults, SETTINGS_FILE);
            this._settings.init().then(() => {
                resolve();
            }).catch(reject);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            if (this._settings === undefined) {
                return resolve();
            }
            this._settings.destroy().then(resolve);
        });
    }

    public getName(): string {
        return 'ServiceStorage';
    }

    public get(): StateFile<IScheme.IStorage> {
        return this._settings as StateFile<IScheme.IStorage>;
    }

}

export default (new ServiceStorage());
