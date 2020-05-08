
export interface ISettingsOperationGetRequest {
    path: string;
    key: string;
}

export class SettingsOperationGetRequest {

    public static signature: string = 'SettingsOperationGetRequest';
    public signature: string = SettingsOperationGetRequest.signature;
    public path: string;
    public key: string;

    constructor(params: ISettingsOperationGetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationGetRequest message`);
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
