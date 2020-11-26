import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { Entry, Field, getEntryKey, getEntryKeyByArgs, ESettingType, IEntry, IField, RemoteField } from '../../../common/settings/field.store';
import { ElementRefs, getElement } from '../../../common/settings/field.render';
import { IPCMessages, Subscription } from './service.electron';
import { PluginField } from '../controllers/plugins/plugin.process.setting.field';

import ServiceElectron from './service.electron';
import Logger from '../tools/env.logger';

export {
    ESettingType,
    Field,
    Entry,
    getEntryKey,
    getEntryKeyByArgs,
    IEntry,
    IField,
    RemoteField,
    ElementRefs,
    getElement,
};

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
    private _register: Map<string, Field<any> | RemoteField<any> | PluginField <any> | Entry> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger = new Logger('ServiceConfig');
    private _index: number = 0;

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage.init().then(resolve).catch(reject);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            if (this._storage === undefined) {
                return resolve();
            }
            this._storage.destroy().then(resolve);
        });
    }

    public getName(): string {
        return 'ServiceConfig';
    }

    public subscribe(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCMessages.SettingsAppDataRequest, this._ipc_SettingsAppDataRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SettingsAppDataRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.SettingsOperationGetRequest, this._ipc_SettingsOperationGetRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SettingsOperationGetRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.SettingsOperationSetRequest, this._ipc_SettingsOperationSetRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SettingsOperationSetRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.SettingsOperationValidateRequest, this._ipc_SettingsOperationValidateRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SettingsOperationValidateRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.SettingsOperationDefaultRequest, this._ipc_SettingsOperationDefaultRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SettingsOperationDefaultRequest = subscription;
                }),
                ServiceElectron.IPC.subscribe(IPCMessages.SettingsRenderRegisterRequest, this._ipc_SettingsRenderRegisterRequest.bind(this)).then((subscription: Subscription) => {
                    this._subscriptions.SettingsRenderRegisterRequest = subscription;
                }),
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public register<T>(entry: Entry | Field<any> | RemoteField<any> | PluginField<any>): Promise<T | undefined> {
        entry.setIndex(this._getIndex());
        return new Promise((resolve, reject) => {
            const key: string = getEntryKey(entry);
            if (this._register.has(key)) {
                if (Field.isInstance(entry) || RemoteField.isInstance(entry) || PluginField.isInstance(entry)) {
                    return reject(new Error(`Entry "${entry.getName()}" is already registered.`));
                } else {
                    return resolve(undefined);
                }
            }
            entry.extract(this._storage.get()).then(() => {
                this._write(entry).then(() => {
                    this._register.set(key, entry);
                    if (Field.isInstance(entry) || RemoteField.isInstance(entry) || PluginField.isInstance(entry)) {
                        resolve((entry as Field<T>).read(this._storage.get()));
                    } else {
                        resolve(undefined);
                    }
                }).catch((wrtErr: Error) => {
                    reject(wrtErr);
                });
            }).catch((extrErr: Error) => {
                reject(extrErr);
            });
        });
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

    private _getIndex(): number {
        return this._index++;
    }

    private _write(entry: Entry): Promise<void> {
        return new Promise((resolve, reject) => {
            const state: Error | IStorage = entry.write(this._storage.get());
            if (state instanceof Error) {
                return reject(state);
            }
            this._storage.set(state).then(() => {
                resolve();
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    private _ipc_SettingsAppDataRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const entries: IEntry[] = [];
        const fields: Array<IField<any>> = [];
        const renders: Array<IField<any>> = [];
        const elements: { [key: string]: ElementRefs } = {};
        this._register.forEach((entry: Entry | Field<any> | RemoteField<any>) => {
            if (RemoteField.isInstance(entry)) {
                renders.push((entry as RemoteField<any>).asField());
            } else if (Field.isInstance(entry) || PluginField.isInstance(entry)) {
                fields.push((entry as Field<any>).asField());
                const elementRef: ElementRefs | undefined = (entry as Field<any>).getElement();
                if (elementRef !== undefined) {
                    elements[entry.getFullPath()] = elementRef;
                }
            } else {
                entries.push(entry.asEntry());
            }
        });
        [entries, fields, renders].forEach((target) => {
            target.sort((a, b) => {
                return (a.index as number) > (b.index as number) ? 1 : -1;
            });
        });
        response(new IPCMessages.SettingsAppDataResponse({
            fields: fields,
            entries: entries,
            renders: renders,
            elements: elements,
            store: this._storage.get(),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on PluginsInstalledRequest due error: ${error.message}`);
        });
    }

    private _ipc_SettingsOperationGetRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const request: IPCMessages.SettingsOperationGetRequest = message as IPCMessages.SettingsOperationGetRequest;
        const key: string = getEntryKeyByArgs(request.path, request.key);
        const entry: Entry | Field<any> | undefined = this._register.get(key);
        if (entry === undefined) {
            return response(new IPCMessages.SettingsOperationGetResponse({
                error: `Field "${key}" isn't found`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationGetResponse due error: ${error.message}`);
            });
        }
        if (!(entry instanceof Field) && !(entry instanceof PluginField)) {
            return response(new IPCMessages.SettingsOperationGetResponse({
                error: `Field "${key}" is Entry and doesn't have value`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationGetResponse due error: ${error.message}`);
            });
        }
        response(new IPCMessages.SettingsOperationGetResponse({
            value: entry.get(),
        })).catch((error: Error) => {
            this._logger.warn(`Fail to send response on SettingsOperationGetResponse due error: ${error.message}`);
        });
    }

    private _ipc_SettingsOperationSetRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const request: IPCMessages.SettingsOperationSetRequest<any> = message as IPCMessages.SettingsOperationSetRequest<any>;
        const key: string = getEntryKeyByArgs(request.path, request.key);
        const entry: Entry | Field<any> | RemoteField<any> | undefined = this._register.get(key);
        if (entry === undefined) {
            return response(new IPCMessages.SettingsOperationSetResponse({
                error: `Field "${key}" isn't found`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
            });
        }
        if (!(entry instanceof Field) && !(entry instanceof RemoteField)) {
            return response(new IPCMessages.SettingsOperationSetResponse({
                error: `Field "${key}" is Entry and doesn't have value`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
            });
        }
        entry.set(request.value).then(() => {
            this._write(entry).then(() => {
                response(new IPCMessages.SettingsOperationSetResponse({})).catch((error: Error) => {
                    this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
                });
            }).catch((wrtErr: Error) => {
                response(new IPCMessages.SettingsOperationSetResponse({
                    error: `Fail to write field "${key}" due error: ${wrtErr.message}`,
                })).catch((error: Error) => {
                    this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
                });
            });
        }).catch((setErr: Error) => {
            this._logger.warn(`Fail to set valid of field "${key}" due error: ${setErr.message}`);
            response(new IPCMessages.SettingsOperationSetResponse({
                error: `Fail to set valid of field "${key}" due error: ${setErr.message}`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_SettingsOperationValidateRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const request: IPCMessages.SettingsOperationValidateRequest<any> = message as IPCMessages.SettingsOperationValidateRequest<any>;
        const key: string = getEntryKeyByArgs(request.path, request.key);
        const entry: Entry | Field<any> | undefined = this._register.get(key);
        if (entry === undefined) {
            return response(new IPCMessages.SettingsOperationValidateResponse({
                error: `Field "${key}" isn't found`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationValidateResponse due error: ${error.message}`);
            });
        }
        if (!(entry instanceof Field) && !(entry instanceof PluginField)) {
            return response(new IPCMessages.SettingsOperationValidateResponse({
                error: `Field "${key}" is Entry and doesn't have value (and doesn't need validate function)`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationValidateResponse due error: ${error.message}`);
            });
        }
        entry.validate(request.value).then(() => {
            response(new IPCMessages.SettingsOperationValidateResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationValidateResponse due error: ${error.message}`);
            });
        }).catch((validErr: Error) => {
            response(new IPCMessages.SettingsOperationValidateResponse({
                error: validErr.message,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationValidateResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_SettingsOperationDefaultRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const request: IPCMessages.SettingsOperationDefaultRequest = message as IPCMessages.SettingsOperationDefaultRequest;
        const key: string = getEntryKeyByArgs(request.path, request.key);
        const entry: Entry | Field<any> | undefined = this._register.get(key);
        if (entry === undefined) {
            return response(new IPCMessages.SettingsOperationDefaultResponse({
                error: `Field "${key}" isn't found`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationDefaultResponse due error: ${error.message}`);
            });
        }
        if (!(entry instanceof Field) && !(entry instanceof PluginField)) {
            return response(new IPCMessages.SettingsOperationDefaultResponse({
                error: `Field "${key}" is Entry and doesn't have value`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationDefaultResponse due error: ${error.message}`);
            });
        }
        entry.getDefault().then((value: any) => {
            response(new IPCMessages.SettingsOperationDefaultResponse({
                value: value,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationDefaultResponse due error: ${error.message}`);
            });
        }).catch((getErr: Error) => {
            response(new IPCMessages.SettingsOperationDefaultResponse({
                error: `Fail to get default value of field "${key}" due error: ${getErr.message}`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationDefaultResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_SettingsRenderRegisterRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const request: IPCMessages.SettingsRenderRegisterRequest<any> = message as IPCMessages.SettingsRenderRegisterRequest<any>;
        const inst: Entry | RemoteField<any> = request.entry !== undefined ? new Entry(request.entry) : new RemoteField<any>(request.field as IField<any>);
        this.register(inst).then(() => {
            response(new IPCMessages.SettingsRenderRegisterResponse({
                value: inst instanceof RemoteField ? inst.read(this._storage.get()) : undefined,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsRenderRegisterResponse due error: ${error.message}`);
            });
        }).catch((entryErr: Error) => {
            response(new IPCMessages.SettingsRenderRegisterResponse({
                error: `Field to register entries due error: ${entryErr.message}`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsRenderRegisterResponse due error: ${error.message}`);
            });
        });
    }

}

export default (new ServiceConfig());
