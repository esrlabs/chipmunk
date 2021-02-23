export interface IShellProcessKillResponse {
    error?: string;
}

export class ShellProcessKillResponse {

    public static signature: string = 'ShellProcessKillResponse';
    public signature: string = ShellProcessKillResponse.signature;
    public error?: string;

    constructor(params: IShellProcessKillResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessKillResponse message`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
    }
}
