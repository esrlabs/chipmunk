export interface IShellRecentCommandsResponse {
    commands: string[];
}

export class ShellRecentCommandsResponse {

    public static signature: string = 'ShellRecentCommandsResponse';
    public signature: string = ShellRecentCommandsResponse.signature;
    public commands: string[];

    constructor(params: IShellRecentCommandsResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellRecentCommandsResponse message`);
        }
        if (!(params.commands instanceof Array)) {
            throw new Error(`Expecting commands to be an Array<string>`);
        }
        this.commands = params.commands;
    }
}
