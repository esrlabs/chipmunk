export interface IShellProcessListRequest {
    session: string;
}

export class ShellProcessListRequest {

    public static signature: string = 'ShellProcessListRequest';
    public signature: string = ShellProcessListRequest.signature;
    public session: string;

    constructor(params: IShellProcessListRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessListRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
