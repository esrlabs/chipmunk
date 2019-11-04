import * as IScheme from './service.window.state.scheme';

import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';

const SETTINGS_FILE = 'config.window.json';

/**
 * @class ServiceWindowState
 * @description Controls browser window state
 */

class ServiceWindowState implements IService {

    private _settings: StateFile<IScheme.IWindowState> | undefined;

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._settings = new StateFile<IScheme.IWindowState>(this.getName(), IScheme.defaults, SETTINGS_FILE);
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
        return 'ServiceWindowState';
    }

    public getSettings(): StateFile<IScheme.IWindowState> {
        return this._settings as StateFile<IScheme.IWindowState>;
    }

}

export default (new ServiceWindowState());
