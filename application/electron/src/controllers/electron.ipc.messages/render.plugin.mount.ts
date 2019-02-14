export interface IRenderMountPlugin {
    name: string;
    location: string;
    token: string;
}

export class RenderMountPlugin {
    public static signature: string = 'PluginMount';
    public signature: string = RenderMountPlugin.signature;
    public name: string = '';
    public location: string = '';
    public token: string = '';

    constructor(params: IRenderMountPlugin) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for HostState message`);
        }
        if (typeof params.name !== 'string' || params.name.trim() === '') {
            throw new Error(`Name of plugin should be provided`);
        }
        if (typeof params.location !== 'string' || params.location.trim() === '') {
            throw new Error(`Location of plugin's files should be provided`);
        }
        if (typeof params.token !== 'string' || params.token.trim() === '') {
            throw new Error(`token of plugin's should be provided`);
        }
        this.name = params.name;
        this.location = params.location;
        this.token = params.token;
    }
}
