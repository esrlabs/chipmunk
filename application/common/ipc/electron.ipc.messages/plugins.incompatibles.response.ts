import * as Common from '../../interfaces/index';

export interface IPluginsIncompatiblesResponse {
    plugins: Common.Plugins.IPlugin[];
}

export class PluginsIncompatiblesResponse {
    public static signature: string = 'PluginsIncompatiblesResponse';
    public signature: string = PluginsIncompatiblesResponse.signature;

    public plugins: Common.Plugins.IPlugin[] = [];

    constructor(params: IPluginsIncompatiblesResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for PluginsIncompatiblesResponse message`);
        }
        if (!(params.plugins instanceof Array)) {
            throw new Error(`Field "plugins" should be Array<Common.Plugins.IPlugin>`);
        }
        this.plugins = params.plugins;
    }
}