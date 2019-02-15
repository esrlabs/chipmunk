export enum EHostState {
    ready = 'ready',        // Host is ready. No any operations
    busy = 'busy',          // Host isn't ready. Some blocked operations are going
    working = 'working',    // Host isn't ready, but can be used, because host has background operations
}

export interface IHostState {
    message?: string;
    state?: EHostState;
}

export class HostState {
    public static States = EHostState;
    public static signature: string = 'HostState';
    public signature: string = HostState.signature;
    public message: string = '';
    public state: EHostState = EHostState.ready;

    constructor(params: IHostState) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        this.message = typeof params.message === 'string' ? params.message : '';
        this.state = typeof params.state === 'string' ? params.state : EHostState.ready;
    }
}
