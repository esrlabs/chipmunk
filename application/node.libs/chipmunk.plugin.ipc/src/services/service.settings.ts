import { ESettingType, Entry, IEntry, Field, IField, IStorage, FieldBase, getEntryKeyByArgs } from '../../../../common/settings/field.store';
import { EElementSignature, Element, ElementCheckboxRef, ElementInputNumberRef, ElementInputStringRef, ElementRefs } from '../../../../common/settings/field.render';
import { IPCMessages } from "../ipc/plugin.ipc.service";

import Subscription from '../tools/tools.subscription';
import PluginIPCService from "../ipc/plugin.ipc.service";

export {
    ESettingType,
    Entry,
    IEntry,
    Field,
    IField,
    IStorage,
    FieldBase,
    EElementSignature,
    Element,
    ElementCheckboxRef,
    ElementInputNumberRef,
    ElementInputStringRef,
    ElementRefs,
};

/**
 * @class ServiceSettings
 * @description Provides access to chipmunk settings.
 */
export class ServiceSettings {

    private _fields: Map<string, Field<any>> = new Map();
    private _subscriptions: { [key: string]: Subscription } = {};
    constructor() {
        Promise.all([
            PluginIPCService.subscribe(IPCMessages.SettingsValidateRequest, this._ipc_SettingsValidateRequest.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SettingsValidateRequest = subscription;
            }),
            PluginIPCService.subscribe(IPCMessages.SettingsDefaultResponse, this._ipc_SettingsDefaultResponse.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.SettingsDefaultResponse = subscription;
            }),
        ]);
    }

    public register(entry: Entry | Field<any>): Promise<void> {
        return new Promise((resolve, reject) => {
            PluginIPCService.request(new IPCMessages.SettingsRegisterRequest({
                entry: Entry.isInstance(entry) ? entry.asEntry() : undefined,
                field: Field.isInstance(entry) ? (entry as Field<any>).asField() : undefined,
            })).then((res: any) => {
                const response: IPCMessages.SettingsRegisterResponse<any> = res as IPCMessages.SettingsRegisterResponse<any>;
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                if (Field.isInstance(entry)) {
                    this._fields.set(entry.getFullPath(), (entry as Field<any>));
                }
                resolve(response.value);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public get<T>(key: string, path: string): Promise<T> {
        return new Promise((resolve, reject) => {
            PluginIPCService.request(new IPCMessages.SettingsGetRequest({
                key: key,
                path: path,
            })).then((res: any) => {
                const response: IPCMessages.SettingsGetResponse<T> = res as IPCMessages.SettingsGetResponse<T>;
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                resolve(response.value);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _ipc_SettingsValidateRequest(req: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        const request: IPCMessages.SettingsValidateRequest<any> = req as IPCMessages.SettingsValidateRequest<any>;
        const key: string = getEntryKeyByArgs(request.path, request.key);
        const field: Field<any> | undefined = this._fields.get(key);
        if (field === undefined) {
            return response(new IPCMessages.SettingsValidateResponse({
                error: `Fail to find field "${key}"`,
            })).catch((error: Error) => {
                console.log(`Fail send SettingsValidateResponse due error: ${error.message}`);
            });
        }
        field.validate(request.value).then(() => {
            response(new IPCMessages.SettingsValidateResponse({})).catch((error: Error) => {
                console.log(`Fail send SettingsValidateResponse due error: ${error.message}`);
            });
        }).catch((valErr: Error) => {
            response(new IPCMessages.SettingsValidateResponse({
                error: valErr.message,
            })).catch((error: Error) => {
                console.log(`Fail send SettingsValidateResponse due error: ${error.message}`);
            });
        });
    }

    private _ipc_SettingsDefaultResponse(req: IPCMessages.TMessage, response: (message: IPCMessages.TMessage) => Promise<void>) {
        const request: IPCMessages.SettingsDefaultRequest = req as IPCMessages.SettingsDefaultRequest;
        const key: string = getEntryKeyByArgs(request.path, request.key);
        const field: Field<any> | undefined = this._fields.get(key);
        if (field === undefined) {
            return response(new IPCMessages.SettingsDefaultResponse({
                error: `Fail to find field "${key}"`,
            })).catch((error: Error) => {
                console.log(`Fail send SettingsDefaultResponse due error: ${error.message}`);
            });
        }
        field.getDefault().then((value: any) => {
            response(new IPCMessages.SettingsDefaultResponse({
                value: value,
            })).catch((error: Error) => {
                console.log(`Fail send SettingsDefaultResponse due error: ${error.message}`);
            });
        }).catch((valErr: Error) => {
            response(new IPCMessages.SettingsDefaultResponse({
                error: valErr.message,
            })).catch((error: Error) => {
                console.log(`Fail send SettingsDefaultResponse due error: ${error.message}`);
            });
        });
    }

}

export default new ServiceSettings();
