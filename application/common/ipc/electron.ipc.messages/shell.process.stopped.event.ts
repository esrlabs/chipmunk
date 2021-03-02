import { IShellProcess } from './shell.process.list.response';

export interface IShellProcessStoppedEvent {
    session: string;
    processes: IShellProcess[];
    error?: string;
}

export class ShellProcessStoppedEvent {

    public static signature: string = 'ShellProcessStoppedEvent';
    public signature: string = ShellProcessStoppedEvent.signature;
    public session: string;
    public processes: IShellProcess[];
    public error?: string;

    constructor(params: IShellProcessStoppedEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessStoppedEvent message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (!(params.processes instanceof Array)) {
            throw new Error(`Expecting process to be an Array<IShellProcess>`);
        }
        if (params.error !== undefined && (typeof params.error !== 'string' || params.error.trim() === '')) {
            throw new Error(`Expecting error to be a string`);
        }
        this.error = params.error;
        this.session = params.session;
        this.processes = params.processes;
    }
}
