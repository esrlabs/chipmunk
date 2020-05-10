import { StateFile } from '../classes/class.statefile';
import { IService } from '../interfaces/interface.service';
import { Entry, Field, getEntryKey, getEntryKeyByArgs, ESettingType, IEntry } from '../../../common/settings/field.store';
import { ElementRefs } from '../../../common/settings/field.render';
import { IPCMessages, Subscription } from './service.electron';

import ServiceElectron from './service.electron';
import Logger from '../tools/env.logger';

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
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Logger = new Logger('ServiceConfig');

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
            ]).then(() => {
                resolve();
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public register(entry: Entry | Field<any>): Promise<void> {
        return new Promise((resolve, reject) => {
            const key: string = getEntryKey(entry);
            if (this._register.has(key)) {
                return new Error(`Entry "${entry.getName()}" is already registered.`);
            }
            entry.extract(this._storage.get()).then(() => {
                const state: Error | IStorage = entry.write(this._storage.get());
                if (state instanceof Error) {
                    return reject(state);
                }
                this._storage.set(state);
                this._register.set(key, entry);
                resolve();
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

    private _ipc_SettingsAppDataRequest(message: IPCMessages.TMessage, response: (instance: any) => any) {
        const entries: IEntry[] = [];
        const fields: IEntry[] = [];
        const elements: { [key: string]: ElementRefs } = {};
        this._register.forEach((entry: Entry | Field<any>) => {
            if (entry instanceof Field) {
                fields.push(entry.asEntry());
                const elementRef: ElementRefs | undefined = entry.getElement();
                if (elementRef !== undefined) {
                    elements[entry.getFullPath()] = elementRef;
                }
            } else {
                entries.push(entry.asEntry());
            }
        });
        response(new IPCMessages.SettingsAppDataResponse({
            fields: fields,
            entries: entries,
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
        if (!(entry instanceof Field)) {
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
        const entry: Entry | Field<any> | undefined = this._register.get(key);
        if (entry === undefined) {
            return response(new IPCMessages.SettingsOperationSetResponse({
                error: `Field "${key}" isn't found`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
            });
        }
        if (!(entry instanceof Field)) {
            return response(new IPCMessages.SettingsOperationSetResponse({
                error: `Field "${key}" is Entry and doesn't have value`,
            })).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
            });
        }
        entry.set(request.value).then(() => {
            response(new IPCMessages.SettingsOperationSetResponse({})).catch((error: Error) => {
                this._logger.warn(`Fail to send response on SettingsOperationSetResponse due error: ${error.message}`);
            });
        }).catch((setErr: Error) => {
            response(new IPCMessages.SettingsOperationSetResponse({
                error: `Fail to set valud of field "${key}" due error: ${setErr.message}`,
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
        if (!(entry instanceof Field)) {
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
        }).catch((setErr: Error) => {
            response(new IPCMessages.SettingsOperationValidateResponse({
                error: `Fail to set valud of field "${key}" due error: ${setErr.message}`,
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
        if (!(entry instanceof Field)) {
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

}

export default (new ServiceConfig());
