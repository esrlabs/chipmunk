export interface IShellProcessRunRequest {
    session: string;
    command: string;
}

export class ShellProcessRunRequest {

    public static signature: string = 'ShellProcessRunRequest';
    public signature: string = ShellProcessRunRequest.signature;
    public command: string;
    public session: string;

    constructor(params: IShellProcessRunRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessRunRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.command !== 'string' || params.command.trim() === '') {
            throw new Error(`Expecting command to be a string`);
        }
        this.session = params.session;
        this.command = params.command;
    }
}
