export interface IShellPresetGetRequest {
    session: string;
}

export class ShellPresetGetRequest {

    public static signature: string = 'ShellPresetGetRequest';
    public signature: string = ShellPresetGetRequest.signature;
    public session: string;

    constructor(params: IShellPresetGetRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellPresetGetRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
