
export interface ISettingsOperationValidateResponse {
    error?: string;
}

export class SettingsOperationValidateResponse {

    public static signature: string = 'SettingsOperationValidateResponse';
    public signature: string = SettingsOperationValidateResponse.signature;
    public error?: string;

    constructor(params: ISettingsOperationValidateResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationValidateResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
    }
}
