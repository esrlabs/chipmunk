// tslint:disable: member-ordering

import {
    Entry,
    FieldBase,
    IEntry,
    ESettingType,
    IField,
    RemoteField,
    Field,
} from '../../../../../../common/settings/field.store';
import {
    ElementRefs,
    EElementSignature,
    getElementType,
} from '../../../../../../common/settings/field.render';
import { IPC } from '../../services/service.electron.ipc';

import ElectronIpcService from '../../services/service.electron.ipc';

export { Entry, IEntry, ESettingType, getElementType, FieldBase, RemoteField, IField, Field };

const CLocalFieldClassSignature = 'CLocalFieldClassSignature';

export abstract class LocalField<T> extends Field<T> {
    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.validate(value)
                .then(() => {
                    ElectronIpcService.request(
                        new IPC.SettingsOperationSetRequest<T>({
                            key: this.getKey(),
                            path: this.getPath(),
                            value: value,
                        }),
                        IPC.SettingsOperationSetResponse,
                    )
                        .then((response: IPC.SettingsOperationSetResponse) => {
                            if (typeof response.error === 'string') {
                                return reject(new Error(response.error));
                            }
                            this.value = value;
                            resolve();
                        })
                        .catch((err: Error) => {
                            reject(err);
                        });
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public setup(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.validate(value)
                .then(() => {
                    this.value = value;
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public refresh(): Promise<T> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(
                new IPC.SettingsOperationGetRequest({
                    key: this.getKey(),
                    path: this.getPath(),
                }),
                IPC.SettingsOperationGetResponse,
            )
                .then((response: IPC.SettingsOperationGetResponse<T>) => {
                    if (response.error !== undefined) {
                        reject(new Error(response.error));
                    } else if (response.value === undefined) {
                        reject(new Error(`Invalid response for SettingsOperationGetResponse`));
                    } else {
                        resolve(response.value);
                    }
                })
                .catch((err: Error) => {
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

    public getElement(): ElementRefs | undefined {
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
            ElectronIpcService.request<IPC.SettingsOperationValidateResponse>(
                new IPC.SettingsOperationValidateRequest<T>({
                    key: this.getKey(),
                    path: this.getPath(),
                    value: value,
                }),
                IPC.SettingsOperationValidateResponse,
            )
                .then((response) => {
                    if (typeof response.error === 'string') {
                        return reject(new Error(response.error));
                    }
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public getDefault(): Promise<T> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request<IPC.SettingsOperationDefaultResponse<T>>(
                new IPC.SettingsOperationDefaultRequest({
                    key: this.getKey(),
                    path: this.getPath(),
                }),
                IPC.SettingsOperationDefaultResponse,
            )
                .then((response) => {
                    if (typeof response.error === 'string') {
                        reject(new Error(response.error));
                    } else if (response.value === undefined) {
                        reject(new Error(`SettingsOperationDefaultResponse returns invalid response`));
                    } else {
                        resolve(response.value);
                    }
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public getElementType(): EElementSignature | undefined {
        return getElementType(this._elementRef);
    }

    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(
                new IPC.SettingsOperationSetRequest<T>({
                    key: this.getKey(),
                    path: this.getPath(),
                    value: value,
                }),
                IPC.SettingsOperationSetResponse,
            )
                .then((response: IPC.SettingsOperationSetResponse) => {
                    if (typeof response.error === 'string') {
                        return reject(new Error(response.error));
                    }
                    this.value = value;
                    resolve();
                })
                .catch((err: Error) => {
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
            ElectronIpcService.request<IPC.SettingsOperationGetResponse<T>>(
                new IPC.SettingsOperationGetRequest({
                    key: this.getKey(),
                    path: this.getPath(),
                }),
                IPC.SettingsOperationGetResponse,
            )
                .then((response) => {
                    if (typeof response.error === 'string') {
                        reject(new Error(response.error));
                    } else if (response.value === undefined) {
                        reject(new Error(`SettingsOperationGetResponse returns invalid response`));
                    } else {
                        resolve(response.value);
                    }
                })
                .catch((err: Error) => {
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
