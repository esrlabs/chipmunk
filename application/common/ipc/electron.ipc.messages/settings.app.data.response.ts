import { IEntry, IStorage } from '../../settings/field.store';
import { ElementRefs } from '../../settings/field.render';

export interface ISettingsAppDataResponse {
    store: IStorage;
    entries: IEntry[];
    fields: IEntry[];
    elements: { [key: string]: ElementRefs };
}

export class SettingsAppDataResponse {
    public static signature: string = 'SettingsAppDataResponse';
    public signature: string = SettingsAppDataResponse.signature;
    public store: IStorage;
    public entries: IEntry[];
    public fields: IEntry[];
    public elements: { [key: string]: ElementRefs };

    constructor(params: ISettingsAppDataResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsAppDataResponse message`);
        }
        if (typeof params.store !== 'object' || params.store === null) {
            throw new Error(`Field "store" should be defined`);
        }
        if (!(params.entries instanceof Array)) {
            throw new Error(`Field "entries" should be an array`);
        }
        if (!(params.fields instanceof Array)) {
            throw new Error(`Field "fields" should be an array`);
        }
        if (typeof params.elements !== 'object' || params.elements === null) {
            throw new Error(`elements "fields" should be an array`);
        }
        this.store = params.store;
        this.entries = params.entries;
        this.fields = params.fields;
        this.elements = params.elements;
    }
}
