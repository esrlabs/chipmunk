export interface IPluginDefault {
    name: string;
}

export class PluginDefaultUninstall {

    public static signature: string = 'PluginDefaultUninstall';
    public signature: string = PluginDefaultUninstall.signature;
    public name: string;

    constructor(params: IPluginDefault) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginDefaultUninstall message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be defined`);
        }
        this.name = params.name;
    }
}
