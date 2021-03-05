export interface IShellSetEnvRequest {
    session: string;
    env?: { [key: string]: string };
    shell?: string;
    pwd?: string;
}

export class ShellSetEnvRequest {

    public static signature: string = 'ShellSetEnvRequest';
    public signature: string = ShellSetEnvRequest.signature;
    public session: string;
    public env?: { [key: string]: string };
    public shell?: string;
    public pwd?: string;

    constructor(params: IShellSetEnvRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellSetEnvRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (params.env !== undefined && (typeof params.env !== 'object' || params.env === null)) {
            throw new Error(`Expecting env to be an { [key: string]: string }`);
        }
        if (params.shell !== undefined && (typeof params.shell !== 'string' || params.shell.trim() === '')) {
            throw new Error(`Expecting shell to be a string`);
        }
        if (params.pwd !== undefined && (typeof params.pwd !== 'string' || params.pwd.trim() === '')) {
            throw new Error(`Expecting pwd to be a string`);
        }
        this.session = params.session;
        this.pwd = params.pwd;
        this.shell = params.shell;
        this.env = params.env;
    }
}
