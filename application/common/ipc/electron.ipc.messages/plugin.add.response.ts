
export interface IPluginAddResponse {
    name?: string;
    error?: string;
}

export class PluginAddResponse {
    public static signature: string = 'PluginAddResponse';
    public signature: string = PluginAddResponse.signature;
    public error?: string;
    public name?: string;

    constructor(params: IPluginAddResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginsAddResponse message`);
        }
        this.name = params.name;
        this.error = params.error;
    }
}
