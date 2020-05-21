
export interface ISettingsValidateResponse {
    error?: string;
}

export class SettingsValidateResponse {

    public static signature: string = 'SettingsValidateResponse';
    public signature: string = SettingsValidateResponse.signature;
    public error?: string;

    constructor(params: ISettingsValidateResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsValidateResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
    }
}
