
export interface IPluginsLogsRequest {
    name: string;
}

export class PluginsLogsRequest {
    public static signature: string = 'PluginsLogsRequest';
    public signature: string = PluginsLogsRequest.signature;

    public name: string;

    constructor(params: IPluginsLogsRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be string`);
        }
        this.name = params.name;
    }
}
