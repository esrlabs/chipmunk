import { IPluginDefault } from './plugin.default.uninstall';

export class PluginDefaultReinstall {

    public static signature: string = 'PluginDefaultReinstall';
    public signature: string = PluginDefaultReinstall.signature;
    public name: string;

    constructor(params: IPluginDefault) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginDefaultReinstall message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Field "name" should be defined`);
        }
        this.name = params.name;
    }
}
