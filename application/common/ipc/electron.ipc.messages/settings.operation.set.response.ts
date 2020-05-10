
export interface ISettingsOperationSetResponse {
    error?: string;
}

export class SettingsOperationSetResponse {

    public static signature: string = 'SettingsOperationSetResponse';
    public signature: string = SettingsOperationSetResponse.signature;
    public error?: string;

    constructor(params: ISettingsOperationSetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationSetResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
    }
}
