export interface IShellProcessBundleRemoveResponse {
    error?: string;
}

export class ShellProcessBundleRemoveResponse {
    public static signature: string = 'ShellProcessBundleRemoveResponse';
    public signature: string = ShellProcessBundleRemoveResponse.signature;
    public error?: string;

    constructor(params: IShellProcessBundleRemoveResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessBundleRemoveResponse message`);
        }
        if (typeof params.error === 'string' && params.error.trim() !== '') {
            this.error = params.error;
        }
    }
}
