
export interface IPluginsUpgradeRequest {
    name: string;
    version?: string;
}

export class PluginsUpgradeRequest {
    public static signature: string = 'PluginsUpgradeRequest';
    public signature: string = PluginsUpgradeRequest.signature;

    public name: string;
    public version?: string;

    constructor(params: IPluginsUpgradeRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginsUpgradeRequest message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be string`);
        }
        this.name = params.name;
        this.version = params.version;
    }
}
