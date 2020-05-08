import { IEntry, IStorage } from '../../settings/field.store';
import { EElementSignature } from '../../settings/field.render';

export interface ISettingsAppDataResponse {
    store: IStorage;
}

export class SettingsAppDataResponse {
    public static signature: string = 'SettingsAppDataResponse';
    public signature: string = SettingsAppDataResponse.signature;
    public guid: string;
    public error?: string;

    constructor(params: ISettingsAppDataResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsAppDataResponse message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
        this.error = params.error;
    }
}
