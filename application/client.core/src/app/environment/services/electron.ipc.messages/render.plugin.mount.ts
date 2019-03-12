export interface IRenderMountPluginInfo {
    name: string;
    location: string;
    token: string;
    id: number;
}

export interface IRenderMountPlugin {
    plugins: IRenderMountPluginInfo[];
}

export class RenderMountPlugin {
    public static signature: string = 'RenderMountPlugin';
    public signature: string = RenderMountPlugin.signature;
    public plugins: IRenderMountPluginInfo[] = [];

    constructor(params: IRenderMountPlugin) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        if (!(params.plugins instanceof Array)) {
            throw new Error(`Expected "plugins" will be IRenderMountPluginInfo[]`);
        }
        this.plugins = params.plugins;
    }
}
