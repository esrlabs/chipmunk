
export interface ISettingsDefaultResponse<T> {
    value?: T;
    error?: string;
}

export class SettingsDefaultResponse<T> {

    public static signature: string = 'SettingsDefaultResponse';
    public signature: string = SettingsDefaultResponse.signature;
    public value?: T;
    public error?: string;

    constructor(params: ISettingsDefaultResponse<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsDefaultResponse message`);
        }
        if (params.error !== undefined && typeof params.error !== 'string') {
            throw new Error(`Field "error" should be defined`);
        }
        this.error = params.error;
        this.value = params.value;
    }
}
