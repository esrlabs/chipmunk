
export interface ISettingsOperationValidateRequest {
    path: string;
    key: string;
}

export class SettingsOperationValidateRequest {

    public static signature: string = 'SettingsOperationValidateRequest';
    public signature: string = SettingsOperationValidateRequest.signature;
    public path: string;
    public key: string;

    constructor(params: ISettingsOperationValidateRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsOperationValidateRequest message`);
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
