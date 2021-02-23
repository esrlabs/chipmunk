export interface IShellProcessKillRequest {
    session: string;
    guid: string;
}

export class ShellProcessKillRequest {

    public static signature: string = 'ShellProcessKillRequest';
    public signature: string = ShellProcessKillRequest.signature;
    public session: string;
    public guid: string;

    constructor(params: IShellProcessKillRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessKillRequest message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Expecting guid to be a string`);
        }
        this.session = params.session;
        this.guid = params.guid;
    }
}
