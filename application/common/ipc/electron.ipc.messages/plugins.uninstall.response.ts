
export interface IPluginsUninstallResponse {
    error?: string;
}

export class PluginsUninstallResponse {
    public static signature: string = 'PluginsUninstallResponse';
    public signature: string = PluginsUninstallResponse.signature;
    public error?: string;

    constructor(params: IPluginsUninstallResponse) {
        this.error = params.error;
    }
}
