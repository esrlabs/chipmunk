
import * as Common from '../../interfaces/index';

export interface IPluginsStoreAvailableResponse {
    plugins: Common.Plugins.IPlugin[];
}

export class PluginsStoreAvailableResponse {
    public static signature: string = 'PluginsStoreAvailableResponse';
    public signature: string = PluginsStoreAvailableResponse.signature;

    public plugins: Common.Plugins.IPlugin[] = [];

    constructor(params: IPluginsStoreAvailableResponse) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for Plugin message`);
        }
        if (!(params.plugins instanceof Array)) {
            throw new Error(`Field "plugins" should be Array<Common.Plugins.IPlugin>`);
        }
        this.plugins = params.plugins;
    }
}
