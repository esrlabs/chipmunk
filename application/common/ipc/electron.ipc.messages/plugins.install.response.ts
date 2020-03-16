export interface IPluginsInstallResponse {
    error?: string;
}

export class PluginsInstallResponse {
    public static signature: string = 'PluginsInstallResponse';
    public signature: string = PluginsInstallResponse.signature;
    public error?: string;

    constructor(params: IPluginsInstallResponse) {
        this.error = params.error;
    }
}