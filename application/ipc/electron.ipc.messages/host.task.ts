export enum EHostTaskState {
    opened = 'opened',      // Host start to do some task
    closed = 'closed',      // Host finish to do some task
}

export interface IHostTask {
    id: string;
    name?: string;
    state?: EHostTaskState;
}

export class HostTask {
    public static States = EHostTaskState;
    public static signature: string = 'HostTask';
    public signature: string = HostTask.signature;
    public id: string = '';
    public name: string = '';
    public state: EHostTaskState = EHostTaskState.opened;

    constructor(params: IHostTask) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new Error(`Task cannot be defined without "id"`);
        }
        this.id = params.id;
        this.name = typeof params.name === 'string' ? params.name : '';
        this.state = typeof params.state === 'string' ? params.state : EHostTaskState.opened;
    }
}
