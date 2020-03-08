
import * as Common from '../../interfaces/index';

export interface IPluginsInstalledResponse {
    plugins: Common.Plugins.IPlugin[];
}

export class PluginsInstalledResponse {
    public static signature: string = 'PluginsInstalledResponse';
    public signature: string = PluginsInstalledResponse.signature;

    public plugins: Common.Plugins.IPlugin[] = [];

    constructor(params: IPluginsInstalledResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (!(params.plugins instanceof Array)) {
            throw new Error(`Field "plugins" should be Array<Common.Plugins.IPlugin>`);
        }
        this.plugins = params.plugins;
    }
}
