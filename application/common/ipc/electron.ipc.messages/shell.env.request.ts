export interface IShellEnvRequest {
    session: string;
}

export class ShellEnvRequest {

    public static signature: string = 'ShellEnvRequest';
    public signature: string = ShellEnvRequest.signature;
    public session: string;

    constructor(params: IShellEnvRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellEnvRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        this.session = params.session;
    }
}
