
export interface IShellRecentCommandsRemove {
    session: string;
    command: string;
}

export class ShellRecentCommandsRemove {

    public static signature: string = 'ShellRecentCommandsRemove';
    public signature: string = ShellRecentCommandsRemove.signature;
    public session: string;
    public command: string;

    constructor(params: IShellRecentCommandsRemove) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellRecentCommandsRemove message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.command !== 'string' || params.command.trim() === '') {
            throw new Error(`Expecting command to be a string`);
        }
        this.session = params.session;
        this.command = params.command;
    }
}
