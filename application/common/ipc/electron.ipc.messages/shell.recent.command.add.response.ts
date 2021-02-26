export interface IShellRecentCommandAddResponse {
    error?: string;
}

export class ShellRecentCommandAddResponse {

    public static signature: string = 'ShellRecentCommandAddResponse';
    public signature: string = ShellRecentCommandAddResponse.signature;
    public error: string | undefined;

    constructor(params: IShellRecentCommandAddResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellRecentCommandAddResponse message`);
        }
        this.error = params.error;
    }
}
