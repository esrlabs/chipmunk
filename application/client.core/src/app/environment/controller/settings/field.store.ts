
import { Entry, IEntry, ESettingType, IField, RenderField, Field } from '../../../../../../common/settings/field.store';
import { ElementRefs, EElementSignature, getElementType } from '../../../../../../common/settings/field.render';
import { IPCMessages } from '../../services/service.electron.ipc';

import ElectronIpcService from '../../services/service.electron.ipc';

export { Entry, IEntry, ESettingType, getElementType, RenderField, IField, Field };

export class ConnectedField<T> extends Entry {

    private _value: T | undefined;
    private _elementRef: ElementRefs | undefined;

    public static isInstance(smth: any): boolean {
        if (typeof smth !== 'object' || smth === null) {
            return false;
        }
        if (typeof smth.constructor !== 'object' || smth.constructor === null) {
            return false;
        }
        return smth.constructor.name === ConnectedField.name;
    }

    constructor(entry: IEntry, elementRef: ElementRefs | undefined) {
        super(entry);
        this._elementRef = elementRef;
    }

    public validate(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsOperationValidateRequest<T>({
                key: this.getKey(),
                path: this.getPath(),
                value: value,
            }), IPCMessages.SettingsOperationValidateResponse).then((response: IPCMessages.SettingsOperationValidateResponse) => {
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
            ElectronIpcService.request(new IPCMessages.SettingsOperationDefaultRequest({
                key: this.getKey(),
                path: this.getPath(),
            }), IPCMessages.SettingsOperationDefaultResponse).then((response: IPCMessages.SettingsOperationDefaultResponse<T>) => {
                resolve(response.value);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public getElementType(): EElementSignature | undefined {
        return getElementType(this._elementRef);
    }

    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsOperationSetRequest<T>({
                key: this.getKey(),
                path: this.getPath(),
                value: value,
            }), IPCMessages.SettingsOperationSetResponse).then((response: IPCMessages.SettingsOperationSetResponse) => {
                if (typeof response.error === 'string') {
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public get(): T {
        if (this._value === undefined) {
            throw new Error(`Value of "${this.getFullPath()}" isn't initialized`);
        }
        return this._value;
    }

    public refresh(): Promise<T> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsOperationGetRequest({
                key: this.getKey(),
                path: this.getPath(),
            }), IPCMessages.SettingsOperationGetResponse).then((response: IPCMessages.SettingsOperationGetResponse<T>) => {
                resolve(response.value);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

}
