export interface IShellProcessBundleSetResponse {
    error?: string;
}

export class ShellProcessBundleSetResponse {
    public static signature: string = 'ShellProcessBundleSetResponse';
    public signature: string = ShellProcessBundleSetResponse.signature;
    public error?: string;

    constructor(params: IShellProcessBundleSetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessBundleSetResponse message`);
        }
        if (typeof params.error === 'string' && params.error.trim() !== '') {
            this.error = params.error;
        }
    }
}
