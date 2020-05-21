
export interface ISettingsGetRequest {
    path: string;
    key: string;
}

export class SettingsGetRequest {

    public static signature: string = 'SettingsGetRequest';
    public signature: string = SettingsGetRequest.signature;
    public path: string;
    public key: string;

    constructor(params: ISettingsGetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for SettingsGetRequest message`);
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
