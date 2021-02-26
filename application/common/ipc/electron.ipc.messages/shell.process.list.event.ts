import { IShellProcess } from './shell.process.list.response';

export interface IShellProcessListEvent {
    session: string;
    processes: IShellProcess[];
}

export class ShellProcessListEvent {

    public static signature: string = 'ShellProcessListEvent';
    public signature: string = ShellProcessListEvent.signature;
    public session: string;
    public processes: IShellProcess[];

    constructor(params: IShellProcessListEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessListEvent message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (!(params.processes instanceof Array)) {
            throw new Error(`Expecting processes to be an Array<IShellProcess>`);
        }
        this.session = params.session;
        this.processes = params.processes;
    }
}
