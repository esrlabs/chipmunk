export interface IShellProcessStat {
    recieved: number;
    created: number;
    terminated: number;
    pid: number;
}

export interface IShellProcessMeta {
    sourceId: number;
    color: string;
}

export interface IShellProcess {
    guid: string;
    command: string;
    env: { [key: string]: string };
    pwd: string;
    stat: IShellProcessStat;
    meta: IShellProcessMeta;
}

export interface IShellProcessTerminatedListResponse {
    session: string;
    processes: IShellProcess[];
}

export class ShellProcessTerminatedListResponse {

    public static signature: string = 'ShellProcessTerminatedListResponse';
    public signature: string = ShellProcessTerminatedListResponse.signature;
    public session: string;
    public processes: IShellProcess[];

    constructor(params: IShellProcessTerminatedListResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessTerminatedListResponse message`);
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
