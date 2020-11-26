// tslint:disable: member-ordering

import * as IPCMessages from '../../../../common/ipc/plugins.ipc.messages/index';

import { guid, Subscription, THandler } from '../../tools/index';
import { ElementRefs, EElementSignature, getElementType, ElementInputStringRef } from '../../../../common/settings/field.render';
import { IField, RemoteFieldWrapper } from '../../../../common/settings/field.store';
import { IControllerIPCPlugin } from './plugin.process.ipc.interface';

const CPluginFieldClassSignature = 'CPluginFieldClassSignature';

export class PluginField<T> extends RemoteFieldWrapper<T> {

    public value: T | undefined;
    private _elementRef: ElementRefs | undefined;
    private _ipc: IControllerIPCPlugin;

    constructor(entry: IField<T>, elementRef: ElementRefs | undefined, ipc: IControllerIPCPlugin) {
        super(entry);
        this._elementRef = elementRef;
        this._ipc = ipc;
        this.value = entry.value;
    }

    public validate(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this._ipc.request(new IPCMessages.SettingsValidateRequest<T>({
                key: this.getKey(),
                path: this.getPath(),
                value: value,
            })).then((res: any) => {
                const response: IPCMessages.SettingsValidateResponse = res as IPCMessages.SettingsValidateResponse;
                if (typeof response.error === 'string') {
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public getDefault(): Promise<T> {
        return new Promise((resolve, reject) => {
            this._ipc.request(new IPCMessages.SettingsDefaultRequest({
                key: this.getKey(),
                path: this.getPath(),
            })).then((res: any) => {
                const response: IPCMessages.SettingsDefaultResponse<T> = res as IPCMessages.SettingsDefaultResponse<T>;
                resolve(response.value as T);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public getElementType(): EElementSignature | undefined {
        return getElementType(this._elementRef);
    }

    public getElement(): ElementRefs | undefined {
        return this._elementRef;
    }

    /**
     * Internal usage
     */
    public getClassSignature(): string {
        return CPluginFieldClassSignature;
    }

    /**
     * Internal usage
     */
    public static isInstance(smth: any): boolean {
        if (typeof smth !== 'object' || smth === null) {
            return false;
        }
        if (typeof smth.getClassSignature !== 'function') {
            return false;
        }
        return smth.getClassSignature() === CPluginFieldClassSignature;
    }

}
