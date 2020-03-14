export interface IApplicationVersions {
    "electron": string;
    "electron-rebuild": string;
    "chipmunk.client.toolkit": string;
    "chipmunk.plugin.ipc": string;
    "chipmunk-client-material": string;
    "angular-core": string;
    "angular-material": string;
    "force": string;
}

export interface ITabCustomAbout {
    version: string;
    dependencies: IApplicationVersions;
}

export class TabCustomAbout {
    public static signature: string = 'TabCustomAbout';
    public signature: string = TabCustomAbout.signature;
    public version: string;
    public dependencies: IApplicationVersions;

    constructor(params: ITabCustomAbout) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for TabCustomAbout message`);
        }
        if (typeof params.version !== 'string' || params.version.trim() === '') {
            throw new Error(`Field "version" should be defined`);
        }
        if (params.dependencies === undefined) {
            throw new Error(`Field "dependencies" should be defined`);
        }
        this.version = params.version;
        this.dependencies = params.dependencies;
    }
}
