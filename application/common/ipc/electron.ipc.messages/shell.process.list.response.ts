export interface IShellProcessStat {
    recieved: number;
    created: number;
    terminated: number;
    pid: number;
    row?: number;
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

export interface IShellProcessListResponse {
    session: string;
    processes: IShellProcess[];
}

export class ShellProcessListResponse {

    public static signature: string = 'ShellProcessListResponse';
    public signature: string = ShellProcessListResponse.signature;
    public session: string;
    public processes: IShellProcess[];

    constructor(params: IShellProcessListResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessListResponse message`);
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
