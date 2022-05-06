export interface IVersions {
    "electron": string;
    "electron-rebuild": string;
    "chipmunk.client.toolkit": string;
    "chipmunk.plugin.ipc": string;
    "chipmunk-client-material": string;
    "angular-core": string;
    "angular-material": string;
    "force": string;
}

export interface IDependencies {
    "electron": boolean;
    "electron-rebuild": boolean;
    "chipmunk.client.toolkit": boolean;
    "chipmunk.plugin.ipc": boolean;
    "chipmunk-client-material": boolean;
    "angular-core": boolean;
    "angular-material": boolean;
    "force": boolean;
}

export const CDefaultDependencies: IDependencies = {
    "electron": true,
    "electron-rebuild": true,
    "chipmunk.client.toolkit": true,
    "chipmunk.plugin.ipc": true,
    "chipmunk-client-material": true,
    "angular-core": true,
    "angular-material": true,
    "force": true,
};