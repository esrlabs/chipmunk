export interface IPluginsUpdateResponse {
    error?: string;
}

export class PluginsUpdateResponse {
    public static signature: string = 'PluginsUpdateResponse';
    public signature: string = PluginsUpdateResponse.signature;
    public error?: string;

    constructor(params: IPluginsUpdateResponse) {
        this.error = params.error;
    }
}