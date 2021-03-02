export interface IShellProcessTerminatedListRequest {
    session: string;
}

export class ShellProcessTerminatedListRequest {

    public static signature: string = 'ShellProcessTerminatedListRequestt';
    public signature: string = ShellProcessTerminatedListRequest.signature;
    public session: string;

    constructor(params: IShellProcessTerminatedListRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessTerminatedListRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
