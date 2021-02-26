export interface IShellEnvResponse {
    env: { [key: string]: string };
    shells: string[];
    shell: string;
    pwd: string;
    error?: string;
}

export class ShellEnvResponse {

    public static signature: string = 'ShellEnvResponse';
    public signature: string = ShellEnvResponse.signature;
    public env: { [key: string]: string };
    public shells: string[];
    public shell: string;
    public pwd: string;
    public error?: string;

    constructor(params: IShellEnvResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellEnvResponse message`);
        }
        if (typeof params.env !== 'object' || params.env === null) {
            throw new Error(`Expecting env to be an { [key: string]: string }`);
        }
        if (!(params.shells instanceof Array)) {
            throw new Error(`Expecting shells to be an Array<string>`);
        }
        if (typeof params.shell !== 'string' || params.shell.trim() === '') {
            throw new Error(`Expecting env to be a string`);
        }
        if (typeof params.pwd !== 'string' || params.pwd.trim() === '') {
            throw new Error(`Expecting pwd to be a string`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.pwd = params.pwd;
        this.shell = params.shell;
        this.shells = params.shells;
        this.env = params.env;
        this.error = params.error;
    }
}
