export interface IPluginStreamAdd {
    guid: string;
}

export class PluginStreamAdd {
    public static signature: string = 'PluginStreamAdd';
    public signature: string = PluginStreamAdd.signature;
    public guid: string;

    constructor(params: IPluginStreamAdd) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginStreamAdd message`);
        }
        if (typeof params.guid !== 'string' || params.guid.trim() === '') {
            throw new Error(`Field "guid" should be defined`);
        }
        this.guid = params.guid;
    }
}
