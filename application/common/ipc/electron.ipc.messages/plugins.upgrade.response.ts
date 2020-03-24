export interface IPluginsUpgradeResponse {
    error?: string;
}

export class PluginsUpgradeResponse {
    public static signature: string = 'PluginsUpgradeResponse';
    public signature: string = PluginsUpgradeResponse.signature;
    public error?: string;

    constructor(params: IPluginsUpgradeResponse) {
        this.error = params.error;
    }
}