export interface ISettingsRenderRegisterResponse<T> {
    error?: string;
    value?: T;
}

export class SettingsRenderRegisterResponse<T> {
    public static signature: string = 'SettingsRenderRegisterResponse';
    public signature: string = SettingsRenderRegisterResponse.signature;
    public error?: string;
    public value?: T;

    constructor(params: ISettingsRenderRegisterResponse<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsRenderRegisterResponse message`);
        }
        this.error = params.error;
        this.value = params.value;
    }
}
