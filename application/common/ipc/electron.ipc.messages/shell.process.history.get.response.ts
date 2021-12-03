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

export interface IBundle {
    title: string;
    commands: string[];
}

export interface IShellProcessHistoryGetResponse {
    session: string;
    processes: IShellProcess[];
    bundles: IBundle[];
}

export class ShellProcessHistoryGetResponse {
    public static signature: string = 'ShellProcessHistoryGetResponse';
    public signature: string = ShellProcessHistoryGetResponse.signature;
    public session: string;
    public processes: IShellProcess[];
    public bundles: IBundle[];

    constructor(params: IShellProcessHistoryGetResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellProcessHistoryGetResponse message`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`Expecting session to be a string`);
        }
        if (!(params.processes instanceof Array)) {
            throw new Error(`Expecting processes to be an Array<IShellProcess>`);
        }
        if (!(params.bundles instanceof Array)) {
            throw new Error(`Expecting processes to be an Array<IBundle>`);
        }
        this.session = params.session;
        this.processes = params.processes;
        this.bundles = params.bundles;
    }
}
