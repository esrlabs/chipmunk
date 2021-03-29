export interface IShellProcessRunRequest {
    session: string;
    command: string;
    shell: string;
    pwd: string;
}

export class ShellProcessRunRequest {

    public static signature: string = 'ShellProcessRunRequest';
    public signature: string = ShellProcessRunRequest.signature;
    public command: string;
    public session: string;
    public shell: string;
    public pwd: string;

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
        if (typeof params.shell !== 'string' || params.shell.trim() === '') {
            throw new Error(`Expecting shell to be a string`);
        }
        if (typeof params.pwd !== 'string' || params.pwd.trim() === '') {
            throw new Error(`Expecting pwd to be a string`);
        }
        this.session = params.session;
        this.command = params.command;
        this.shell = params.shell;
        this.pwd = params.pwd;
    }
}
