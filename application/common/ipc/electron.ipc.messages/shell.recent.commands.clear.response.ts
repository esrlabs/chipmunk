export interface IShellRecentCommandsClearResponse {
    error?: string;
}

export class ShellRecentCommandsClearResponse {

    public static signature: string = 'ShellRecentCommandsClearResponse';
    public signature: string = ShellRecentCommandsClearResponse.signature;
    public error: string | undefined;

    constructor(params: IShellRecentCommandsClearResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellRecentCommandsClearResponse message`);
        }
        this.error = params.error;
    }
}
