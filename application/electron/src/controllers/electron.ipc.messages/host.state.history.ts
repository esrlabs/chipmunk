export interface IHostStateHistory {
    history?: string[];
}

export class HostStateHistory {
    public static signature: string = 'HostStateHistory';
    public history: string[] = [];

    constructor(params: IHostStateHistory) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        this.history = params.history instanceof Array ? params.history : [];
    }
}
