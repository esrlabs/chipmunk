export interface IList {
    major: string;
    minor: string;
    icon: string | undefined;
}

export interface IJob {
    name: string;
    desc: string;
    icon: string | undefined;
}

export enum OriginType {
    net = 'net',
    serial = 'serial',
    command = 'command',
    file = 'file',
}
export interface IOriginDetails extends IList {
    type: OriginType;
    action: string;
    state: {
        running: string;
        stopped: string;
    };
}

export abstract class List {
    public abstract desc(): IList;
}

export abstract class Job {
    public abstract asJob(): IJob;
}

export abstract class OriginDetails {
    public abstract desc(): IOriginDetails;
}
