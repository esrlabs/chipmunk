export interface IShellRecentCommandAddRequest {
    command: string;
}

export class ShellRecentCommandAddRequest {

    public static signature: string = 'ShellRecentCommandAddRequest';
    public signature: string = ShellRecentCommandAddRequest.signature;
    public command: string;

    constructor(params: IShellRecentCommandAddRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellRecentCommandAddRequest message`);
        }
        if (typeof params.command !== 'string' || params.command.trim() === '') {
            throw new Error(`command should be not empty string.`);
        }
        this.command = params.command;
    }
}
