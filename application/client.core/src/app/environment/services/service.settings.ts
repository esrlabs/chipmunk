import { IPCMessages, Subscription } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';
import { Field, Entry, IEntry, ESettingType  } from '../controller/settings/field.store';

import ElectronIpcService from './service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ESettingType };

export class SettingsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SettingsService');
    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor() {
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'SettingsService';
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    public get(): Promise<Map<string, Entry | Field<any>>> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsAppDataRequest(), IPCMessages.SettingsAppDataResponse).then((response: IPCMessages.SettingsAppDataResponse) => {
                const entries: Map<string, Entry | Field<any>> = new Map();
                response.entries.forEach((data: IEntry) => {
                    const entry: Entry = new Entry(data);
                    entries.set(entry.getFullPath(), entry);
                });
                response.fields.forEach((data: IEntry) => {
                    const entry: Entry = new Entry(data);
                    const field: Field<any> = new Field<any>(data, response.elements[entry.getFullPath()]);
                    entries.set(field.getFullPath(), field);
                });
                resolve(entries);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

}

export default (new SettingsService());
