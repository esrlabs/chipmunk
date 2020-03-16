
export interface IPluginsUninstallRequest {
    name: string;
}

export class PluginsUninstallRequest {
    public static signature: string = 'PluginsUninstallRequest';
    public signature: string = PluginsUninstallRequest.signature;

    public name: string;

    constructor(params: IPluginsUninstallRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be string`);
        }
        this.name = params.name;
    }
}
