export interface IHostTaskHistoryItem {
    id: string;
    name: string;
}

export interface IHostTaskHistory {
    tasks: IHostTaskHistoryItem[];
}

export class HostTaskHistory {
    public static signature: string = 'HostTaskHistory';
    public signature: string = HostTaskHistory.signature;
    public tasks: IHostTaskHistoryItem[] = [];

    constructor(params: IHostTaskHistory) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        if (!(params.tasks instanceof Array)) {
            throw new Error(`List of tasks should be an array`);
        }
        this.tasks = params.tasks;
    }
}
