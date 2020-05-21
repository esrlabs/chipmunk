
export interface ISettingsValidateRequest<T> {
    path: string;
    key: string;
    value: T;
}

export class SettingsValidateRequest<T> {

    public static signature: string = 'SettingsValidateRequest';
    public signature: string = SettingsValidateRequest.signature;
    public path: string;
    public key: string;
    public value: T;

    constructor(params: ISettingsValidateRequest<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsValidateRequest message`);
        }
        if (typeof params.path !== 'string') {
            throw new Error(`Field "path" should be defined`);
        }
        if (typeof params.key !== 'string' || params.key.trim() === '') {
            throw new Error(`Field "key" should be defined`);
        }
        this.path = params.path;
        this.key = params.key;
        this.value = params.value;
    }

}
