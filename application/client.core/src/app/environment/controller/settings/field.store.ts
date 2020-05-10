
import { Entry, IEntry, ESettingType } from '../../../../../../common/settings/field.store';
import { ElementRefs } from '../../../../../../common/settings/field.render';
import { IPCMessages } from '../../services/service.electron.ipc';

import ElectronIpcService from '../../services/service.electron.ipc';

export { Entry, IEntry, ESettingType };

export class Field<T> extends Entry {

    private _value: T | undefined;
    private _elementRef: ElementRefs | undefined;

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
            })).then((response: IPCMessages.SettingsOperationValidateResponse) => {
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
            })).then((response: IPCMessages.SettingsOperationDefaultResponse<T>) => {
                resolve(response.value);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public getElement(): Promise<void> {
        return new Promise((resolve, reject) => {
            //
        });
    }

    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request(new IPCMessages.SettingsOperationSetRequest<T>({
                key: this.getKey(),
                path: this.getPath(),
                value: value,
            })).then((response: IPCMessages.SettingsOperationSetResponse) => {
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
            })).then((response: IPCMessages.SettingsOperationGetResponse<T>) => {
                resolve(response.value);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

}
