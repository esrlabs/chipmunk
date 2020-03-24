
export interface IPluginsUpdateRequest {
    name: string;
    version?: string;
}

export class PluginsUpdateRequest {
    public static signature: string = 'PluginsUpdateRequest';
    public signature: string = PluginsUpdateRequest.signature;

    public name: string;
    public version?: string;

    constructor(params: IPluginsUpdateRequest) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginsUpdateRequest message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be string`);
        }
        this.name = params.name;
        this.version = params.version;
    }
}
