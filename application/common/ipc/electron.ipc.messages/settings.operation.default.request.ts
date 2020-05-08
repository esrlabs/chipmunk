
export interface ISettingsOperationDefaultRequest {
    path: string;
    key: string;
}

export class SettingsOperationDefaultRequest {

    public static signature: string = 'SettingsOperationDefaultRequest';
    public signature: string = SettingsOperationDefaultRequest.signature;
    public path: string;
    public key: string;

    constructor(params: ISettingsOperationDefaultRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationDefaultRequest message`);
        }
        if (typeof params.path !== 'string') {
            throw new Error(`Field "path" should be defined`);
        }
        if (typeof params.key !== 'string' || params.key.trim() === '') {
            throw new Error(`Field "key" should be defined`);
        }
        this.path = params.path;
        this.key = params.key;
    }

}
