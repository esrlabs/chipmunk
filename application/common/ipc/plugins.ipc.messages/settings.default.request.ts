export interface ISettingsDefaultRequest {
    path: string;
    key: string;
}

export class SettingsDefaultRequest {

    public static signature: string = 'SettingsDefaultRequest';
    public signature: string = SettingsDefaultRequest.signature;
    public path: string;
    public key: string;

    constructor(params: ISettingsDefaultRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsDefaultRequest message`);
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
