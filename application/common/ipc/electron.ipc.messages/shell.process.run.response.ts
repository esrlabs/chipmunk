export interface IShellProcessRunResponse {
    guid?: string;
    error?: string;
}

export class ShellProcessRunResponse {

    public static signature: string = 'ShellProcessRunResponse';
    public signature: string = ShellProcessRunResponse.signature;
    public error?: string;
    public guid?: string;

    constructor(params: IShellProcessRunResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessRunResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        if (params.guid !== undefined && (typeof params.guid !== 'string' || params.guid.trim() === '')) {
            throw new Error(`Expecting guid to be a string`);
        }
        this.error = params.error;
        this.guid = params.guid;
    }
}
