
export interface ISettingsOperationDefaultResponse {
    error?: string;
}

export class SettingsOperationDefaultResponse {

    public static signature: string = 'SettingsOperationDefaultResponse';
    public signature: string = SettingsOperationDefaultResponse.signature;
    public error?: string;

    constructor(params: ISettingsOperationDefaultResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationDefaultResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string' || params.error.trim() === '') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
    }
}
