export interface ISettingsGetResponse<T> {
    value?: T;
    error?: string;
}

export class SettingsGetResponse<T> {

    public static signature: string = 'SettingsGetResponse';
    public signature: string = SettingsGetResponse.signature;
    public value?: T;
    public error?: string;

    constructor(params: ISettingsGetResponse<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsGetResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
        this.value = params.value;
    }
}
