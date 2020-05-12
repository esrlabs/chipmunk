import { IEntry, IField } from '../../settings/field.store';

export interface ISettingsRenderRegisterRequest<T> {
    entry?: IEntry;
    field?: IField<any>;
}

export class SettingsRenderRegisterRequest<T> {
    public static signature: string = 'SettingsRenderRegisterRequest';
    public signature: string = SettingsRenderRegisterRequest.signature;
    public entry?: IEntry;
    public field?: IField<T>;

    constructor(params: ISettingsRenderRegisterRequest<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsRenderRegisterRequest message`);
        }
        if (params.entry === undefined && params.field === undefined) {
            throw new Error(`At least entry or field should be present`);
        }
        this.entry = params.entry;
        this.field = params.field;
    }
}
