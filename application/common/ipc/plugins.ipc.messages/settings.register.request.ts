import { IEntry, IField } from '../../settings/field.store';

export interface ISettingsRegisterRequest<T> {
    entry?: IEntry;
    field?: IField<any>;
}

export class SettingsRegisterRequest<T> {
    public static signature: string = 'SettingsRegisterRequest';
    public signature: string = SettingsRegisterRequest.signature;
    public entry?: IEntry;
    public field?: IField<T>;

    constructor(params: ISettingsRegisterRequest<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsRegisterRequest message`);
        }
        if (params.entry === undefined && params.field === undefined) {
            throw new Error(`At least entry or field should be present`);
        }
        this.entry = params.entry;
        this.field = params.field;
    }
}
