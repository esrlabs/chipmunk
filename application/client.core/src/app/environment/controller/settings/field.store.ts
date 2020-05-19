
// tslint:disable: member-ordering

import { Entry, FieldBase, IEntry, ESettingType, IField, RenderField, Field } from '../../../../../../common/settings/field.store';
import { ElementRefs, EElementSignature, getElementType } from '../../../../../../common/settings/field.render';
import { IPCMessages } from '../../services/service.electron.ipc';

import ElectronIpcService from '../../services/service.electron.ipc';

export { Entry, IEntry, ESettingType, getElementType, FieldBase, RenderField, IField, Field };

const CLocalFieldClassSignature = 'CLocalFieldClassSignature';

export abstract class LocalField<T> extends Field<T> {

    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.validate(value).then(() => {
                ElectronIpcService.request(new IPCMessages.SettingsOperationSetRequest<T>({
                    key: this.getKey(),
                    path: this.getPath(),
                    value: value,
                }), IPCMessages.SettingsOperationSetResponse).then((response: IPCMessages.SettingsOperationSetResponse) => {
                    if (typeof response.error === 'string') {
                        return reject(new Error(response.error));
                    }
                    this.value = value;
                    resolve();
                }).catch((err: Error) => {
                    reject(err);
                });
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public setup(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.validate(value).then(() => {
                this.value = value;
                resolve();
            }).catch((err: Error) => {
                reject(err);
            });
        });
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

    /**
     * Internal usage
     */
    public getClassSignature(): string {
        return CLocalFieldClassSignature;
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
        return smth.getClassSignature() === CLocalFieldClassSignature;
    }

}

export class LocalFieldAPIWrapper<T> extends LocalField<T> {

    private _field: Field<T>;

    constructor(field: Field<T>) {
        super(field.asField());
        this._field = field;
    }

    public validate(value: T): Promise<void> {
        return this._field.validate(value);
    }

    public getDefault(): Promise<T> {
        return this._field.getDefault();
    }

    public getElementType(): EElementSignature | undefined {
        return this._field.getElementType();
    }

    public getElement(): ElementRefs {
        return this._field.getElement();
    }

}

const CConnectedFieldClassSignature = 'CConnectedFieldClassSignature';

export class ConnectedField<T> extends FieldBase<T> {

    private _elementRef: ElementRefs | undefined;

    constructor(entry: IField<T>, elementRef: ElementRefs | undefined) {
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
                this.value = value;
                resolve();
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public get(): T {
        if (this.value === undefined) {
            throw new Error(`Value of "${this.getFullPath()}" isn't initialized`);
        }
        return this.value;
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

    /**
     * Internal usage
     */
    public getClassSignature(): string {
        return CConnectedFieldClassSignature;
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
        return smth.getClassSignature() === CConnectedFieldClassSignature;
    }

}
