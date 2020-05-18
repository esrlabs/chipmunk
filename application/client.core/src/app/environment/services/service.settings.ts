import { IPCMessages, Subscription } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';
import { ConnectedField, Entry, IEntry, ESettingType, IField, Field, LocalField, LocalFieldAPIWrapper } from '../controller/settings/field.store';
import { ISettingsAPI } from 'chipmunk.client.toolkit';

import ElectronIpcService from './service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export { ESettingType };

const CPluginsSettingsGroupKey = 'plugins';

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

    public get<T>(key: string, path: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const local: LocalField<T> | Entry | undefined = this._register.get(path);
            if (LocalField.isInstance(local)) {
                return (local as LocalField<T>).refresh();
            }
            ElectronIpcService.request(new IPCMessages.SettingsOperationGetRequest({
                key: key,
                path: path,
            }), IPCMessages.SettingsOperationGetResponse).then((response: IPCMessages.SettingsOperationGetResponse<T>) => {
                resolve(response.value);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public entries(): Promise<Map<string, Entry | ConnectedField<any> | Field<any>>> {
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

    public register(smth: Entry | LocalField<any>): Promise<void> {
        return new Promise((resolve, reject) => {
            const entry: Entry | undefined = Entry.isInstance(smth) ? smth as Entry : undefined;
            const field: LocalField<any> | undefined = LocalField.isInstance(smth) ? smth as LocalField<any> : undefined;
            ElectronIpcService.request(new IPCMessages.SettingsRenderRegisterRequest({
                entry: entry ? entry.asEntry() : undefined,
                field: field ? Object.assign({ value: field.get() }, field.asEntry()) : undefined,
            }), IPCMessages.SettingsRenderRegisterResponse).then((response: IPCMessages.SettingsRenderRegisterResponse<any>) => {
                if (field && response.value !== undefined) {
                    field.setup(response.value).then(() => {
                        this._register.set(field.getFullPath(), field);
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

    public getPluginsAPI(): ISettingsAPI {
        return {
            get: this._api_get.bind(this),
            register: this._api_register.bind(this),
        };
    }

    private _api_get<T>(key: string, path: string): Promise<T> {
        return this.get(key, path);
    }

    private _api_register(smth: Entry | Field<any>): Promise<void> {
        return new Promise((resolve, reject) => {
            // Create holder before
            this.register(new Entry({
                name: 'Plugins',
                desc: 'Settings of plugins',
                key: CPluginsSettingsGroupKey,
                path: '',
                type: ESettingType.standard,
            })).then(() => {
                // Update a path (move plugin setting into plugins-wrapper)
                smth.setPath(smth.getPath() === '' ? CPluginsSettingsGroupKey : `${CPluginsSettingsGroupKey}.${smth.getPath()}`);
                // Create entry or field
                const entry: Entry | undefined = Entry.isInstance(smth) ? smth as Entry : undefined;
                const field: Field<any> | undefined = Field.isInstance(smth) ? smth as Field<any> : undefined;
                if (field) {
                    this.register(new LocalFieldAPIWrapper(field)).then(resolve).catch(reject);
                } else {
                    this.register(entry).then(resolve).catch(reject);
                }
            }).catch((wrapErr: Error) => {
                this._logger.warn(`Fail to create wrapper of plugins settings due error: ${wrapErr.message}`);
                reject(wrapErr);
            });
        });
    }
}

export default (new SettingsService());
