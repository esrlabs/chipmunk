
export interface ISettingsOperationDefaultResponse<T> {
    value?: T;
    error?: string;
}

export class SettingsOperationDefaultResponse<T> {

    public static signature: string = 'SettingsOperationDefaultResponse';
    public signature: string = SettingsOperationDefaultResponse.signature;
    public value?: T;
    public error?: string;

    constructor(params: ISettingsOperationDefaultResponse<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationDefaultResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
        this.value = params.value;
    }
}
