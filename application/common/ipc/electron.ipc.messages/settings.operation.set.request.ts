
export interface ISettingsOperationSetRequest<T> {
    path: string;
    key: string;
    value: T;
}

export class SettingsOperationSetRequest<T> {

    public static signature: string = 'SettingsOperationSetRequest';
    public signature: string = SettingsOperationSetRequest.signature;
    public path: string;
    public key: string;
    public value: T;

    constructor(params: ISettingsOperationSetRequest<T>) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationSetRequest message`);
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
