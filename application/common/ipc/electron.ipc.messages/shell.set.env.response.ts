export interface IShellSetEnvResponse {
    error?: string;
}

export class ShellSetEnvResponse {

    public static signature: string = 'ShellSetEnvResponse';
    public signature: string = ShellSetEnvResponse.signature;
    public error?: string;

    constructor(params: IShellSetEnvResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellSetEnvResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
    }
}
