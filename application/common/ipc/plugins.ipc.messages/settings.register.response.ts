export interface ISettingsRegisterResponse<T> {
    error?: string;
    value?: T;
}

export class SettingsRegisterResponse<T> {
    public static signature: string = 'SettingsRegisterResponse';
    public signature: string = SettingsRegisterResponse.signature;
    public error?: string;
    public value?: T;

    constructor(params: ISettingsRegisterResponse<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsRegisterResponse message`);
        }
        this.error = params.error;
        this.value = params.value;
    }
}
