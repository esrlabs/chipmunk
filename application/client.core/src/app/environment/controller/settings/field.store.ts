
import { Entry, IEntry } from '../../../../../../common/settings/field.store';
import { IPCMessages } from '../../services/service.electron.ipc';

import ElectronIpcService from '../../services/service.electron.ipc';

export class Field<T> extends Entry {

    private _value: T | undefined;

    constructor(entry: IEntry) {
        super(entry);
    }

    public validate(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            ElectronIpcService.request().then(())

        });
    }

    public getDefault(): Promise<T> {
        return new Promise((resolve, reject) => {
            //
        });
    }

    public getElement(): Promise<void> {
        return new Promise((resolve, reject) => {
            //
        });
    }

    public set(value: T): Promise<void> {
        return new Promise((resolve, reject) => {
            this.validate(value).then(() => {
                this._value = value;
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

}
