import { IPCMessages, Subscription } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';
import { ConnectedField, Entry, IEntry, ESettingType, IField, Field, LocalField } from '../controller/settings/field.store';

import ElectronIpcService from './service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ESettingType };

export class SettingsService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('SettingsService');
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _register: Map<string, Field<any>> = new Map();

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

    public get(): Promise<Map<string, Entry | ConnectedField<any> | Field<any>>> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsAppDataRequest(), IPCMessages.SettingsAppDataResponse).then((response: IPCMessages.SettingsAppDataResponse) => {
                const entries: Map<string, Entry | ConnectedField<any>> = new Map();
                response.entries.forEach((data: IEntry) => {
                    const entry: Entry = new Entry(data);
                    entries.set(entry.getFullPath(), entry);
                });
                response.fields.forEach((data: IField<any>) => {
                    const entry: Entry = new Entry(data);
                    const field: ConnectedField<any> = new ConnectedField<any>(data, response.elements[entry.getFullPath()]);
                    entries.set(field.getFullPath(), field);
                });
                response.renders.forEach((data: IField<any>) => {
                    const entry: Entry = new Entry(data);
                    const field: Field<any> | undefined = this._register.get(entry.getFullPath());
                    if (field !== undefined) {
                        entries.set(field.getFullPath(), field);
                    }
                });
                resolve(entries);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public register(entry: Entry | LocalField<any>): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsRenderRegisterRequest({
                entry: !(entry instanceof LocalField) ? entry.asEntry() : undefined,
                field: entry instanceof LocalField ? Object.assign({ value: entry.get() }, entry.asEntry()) : undefined,
            }), IPCMessages.SettingsRenderRegisterResponse).then((response: IPCMessages.SettingsRenderRegisterResponse<any>) => {
                if (entry instanceof LocalField && response.value !== undefined) {
                    entry.setup(response.value).then(() => {
                        this._register.set(entry.getFullPath(), entry);
                        resolve();
                    }).catch((setErr: Error) => {
                        reject(setErr);
                    });
                } else {
                    resolve();
                }
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

}

export default (new SettingsService());
