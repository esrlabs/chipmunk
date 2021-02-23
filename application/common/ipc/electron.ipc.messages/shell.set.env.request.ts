export interface IShellSetPwdRequest {
    session: string;
    env?: Array<{ key: string, value: string }>;
    paths?: string[];
    shells?: string[];
    shell?: string;
    pwd?: string;
}

export class ShellSetPwdRequest {

    public static signature: string = 'ShellSetPwdRequest';
    public signature: string = ShellSetPwdRequest.signature;
    public session: string;
    public env?: Array<{ key: string, value: string }>;
    public paths?: string[];
    public shells?: string[];
    public shell?: string;
    public pwd?: string;

    constructor(params: IShellSetPwdRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellSetPwdRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (params.env !== undefined && !(params.env instanceof Array)) {
            throw new Error(`Expecting env to be an Array<{ key: string, value: string }>`);
        }
        if (params.paths !== undefined && !(params.paths instanceof Array)) {
            throw new Error(`Expecting paths to be an Array<string>`);
        }
        if (params.shells !== undefined && !(params.shells instanceof Array)) {
            throw new Error(`Expecting shells to be an Array<string>`);
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
        this.shells = params.shells;
        this.paths = params.paths;
        this.env = params.env;
    }
}
