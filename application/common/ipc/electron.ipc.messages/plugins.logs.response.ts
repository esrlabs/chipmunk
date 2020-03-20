export interface IPluginsLogsResponse {
    error?: string;
    logs: string;
}

export class PluginsLogsResponse {
    public static signature: string = 'PluginsLogsResponse';
    public signature: string = PluginsLogsResponse.signature;
    public logs: string = '';
    public error?: string;

    constructor(params: IPluginsLogsResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginsLogsResponse message`);
        }
        if (typeof params.logs !== 'string') {
            throw new Error(`Field "logs" should be string`);
        }
        this.logs = params.logs;
        this.error = params.error;
    }
}