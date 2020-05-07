export interface ISettingsAppResponse {
    guid: string;
    error?: string;
}

export class SettingsAppResponse {
    public static signature: string = 'SettingsAppResponse';
    public signature: string = SettingsAppResponse.signature;
    public guid: string;
    public error?: string;

    constructor(params: ISettingsAppResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsAppResponse message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
        this.error = params.error;
    }
}
