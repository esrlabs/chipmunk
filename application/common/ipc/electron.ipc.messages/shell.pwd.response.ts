export interface IShellPwdResponse {
    value: string;
    guid: string;
    error?: string;
}

export class ShellPwdResponse {

    public static signature: string = 'ShellPwdResponse';
    public signature: string = ShellPwdResponse.signature;
    public value: string;
    public guid: string;
    public error?: string;

    constructor(params: IShellPwdResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellPwdResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        if (params.guid !== undefined && (typeof params.guid !== 'string' || params.guid.trim() === '')) {
            throw new Error(`Expecting guid to be a string`);
        }
        if (params.value !== undefined && (typeof params.value !== 'string')) {
            throw new Error(`Expecting value to be a string`);
        }
        this.error = params.error;
        this.guid = params.guid;
        this.value = params.value;
    }
}
