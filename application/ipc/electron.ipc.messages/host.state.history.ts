export interface IHostStateHistory {
    history?: string[];
}

export class HostStateHistory {
    public static signature: string = 'HostStateHistory';
    public signature: string = HostStateHistory.signature;
    public history: string[] = [];

    constructor(params: IHostStateHistory) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostStateHistory message`);
        }
        this.history = params.history instanceof Array ? params.history : [];
    }
}
