export interface IShellSetPwdResponse {
    error?: string;
}

export class ShellSetPwdResponse {

    public static signature: string = 'ShellSetPwdResponse';
    public signature: string = ShellSetPwdResponse.signature;
    public error?: string;

    constructor(params: IShellSetPwdResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellSetPwdResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
    }
}
