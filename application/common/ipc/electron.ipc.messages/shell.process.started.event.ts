export interface IShellProcessStartedEvent {
    session: string;
    guid: string
}

export class ShellProcessStartedEvent {

    public static signature: string = 'ShellProcessStartedEvent';
    public signature: string = ShellProcessStartedEvent.signature;
    public session: string;
    public guid: string;

    constructor(params: IShellProcessStartedEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessStartedEvent message`);
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
