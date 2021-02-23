export interface IShellProcessStoppedEvent {
    session: string;
    guid: string;
    error?: string;
}

export class ShellProcessStoppedEvent {

    public static signature: string = 'ShellProcessStoppedEvent';
    public signature: string = ShellProcessStoppedEvent.signature;
    public session: string;
    public guid: string;
    public error?: string;

    constructor(params: IShellProcessStoppedEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessStoppedEvent message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Expecting guid to be a string`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
        this.session = params.session;
        this.guid = params.guid;
    }
}
