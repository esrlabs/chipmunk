export interface ISettingsOperationGetResponse<T> {
    value?: T;
    error?: string;
}

export class SettingsOperationGetResponse<T> {

    public static signature: string = 'SettingsOperationGetResponse';
    public signature: string = SettingsOperationGetResponse.signature;
    public value?: T;
    public error?: string;

    constructor(params: ISettingsOperationGetResponse<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationGetResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
        this.value = params.value;
    }
}
