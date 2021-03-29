export interface IShellPwdRequest {
    session: string;
}

export class ShellPwdRequest {

    public static signature: string = 'ShellPwdRequest';
    public signature: string = ShellPwdRequest.signature;
    public session: string;

    constructor(params: IShellPwdRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellPwdRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
