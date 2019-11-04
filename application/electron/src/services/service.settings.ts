import * as IScheme from './service.settings.scheme';

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';

const SETTINGS_FILE = 'config.application.json';

/**
 * @class ServiceConfig
 * @description Provides access to logviewer configuration. Used on electron level
 */

class ServiceConfig implements IService {

    private _settings: StateFile<IScheme.ISettings> | undefined;

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._settings = new StateFile<IScheme.ISettings>(this.getName(), IScheme.defaults, SETTINGS_FILE, true);
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
        return 'ServiceConfig';
    }

    public getSettings(): StateFile<IScheme.ISettings> {
        return this._settings as StateFile<IScheme.ISettings>;
    }

}

export default (new ServiceConfig());
