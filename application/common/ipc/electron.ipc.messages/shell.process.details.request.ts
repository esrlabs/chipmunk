export interface IShellProcessDetailsRequest {
    session: string;
    guid: string
}

export class ShellProcessDetailsRequest {

    public static signature: string = 'ShellProcessDetailsRequest';
    public signature: string = ShellProcessDetailsRequest.signature;
    public session: string;
    public guid: string;

    constructor(params: IShellProcessDetailsRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessDetailsRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Expecting guid to be a string`);
        }
        this.session = params.session;
        this.guid = params.guid;
    }
}
