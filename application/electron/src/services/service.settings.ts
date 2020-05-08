import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { Entry, Field, getEntryKey, ESettingType } from '../../../common/settings/field';

export { ESettingType, Field };

const SETTINGS_FILE = 'config.application.json';

interface IStorage {
    [key: string]: number | string | boolean | IStorage;
}

/**
 * @class ServiceConfig
 * @description Provides access to logviewer configuration. Used on electron level
 */

class ServiceConfig implements IService {

    private _storage: StateFile<IStorage> = new StateFile<IStorage>(this.getName(), {}, SETTINGS_FILE, true);
    private _register: Map<string, Field<any> | Entry> = new Map();

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage.init().then(() => {
                resolve();
            }).catch(reject);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            if (this._storage === undefined) {
                return resolve();
            }
            this._storage.destroy().then(resolve);
        });
    }

    public getName(): string {
        return 'ServiceConfig';
    }

    public register(entry: Entry | Field<any>): Error | undefined {
        const key: string = getEntryKey(entry);
        if (this._register.has(key)) {
            return new Error(`Entry "${entry.getName()}" is already registered.`);
        }
        if (entry instanceof Field) {
            const extrErr: Error | undefined = entry.extract(this._storage.get());
            if (extrErr instanceof Error) {
                return extrErr;
            }
        }
        const state: Error | IStorage = entry.write(this._storage.get());
        if (state instanceof Error) {
            return state;
        }
        this._storage.set(state);
        this._register.set(key, entry);
        return undefined;
    }

    public get<T>(path: string): T | Error {
        const field: Entry | Field<T> | undefined = this._register.get(path);
        if (field === undefined) {
            return new Error(`No settings is registered by path "${path}"`);
        }
        if (!(field instanceof Field)) {
            return new Error(`Detected by path "${path}" setting is a group`);
        }
        return field.get();
    }

}

export default (new ServiceConfig());
