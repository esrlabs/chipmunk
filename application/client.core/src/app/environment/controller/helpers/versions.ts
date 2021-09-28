import { CommonInterfaces } from '../../interfaces/interface.common';
import { IPC } from '../../interfaces/interface.ipc';

export interface IDependencyVersion {
    name: string;
    version: string;
    description: string;
}

export interface IDependencyState {
    name: string;
    depended: boolean;
    description: string;
}

interface IDependency {
    name: string;
    description: string;
}
export interface IDependenciesList {
    [key: string]: string;
}
export const CDependencies: { [key: string]: IDependency } = {
    electron: { name: 'Electron', description: 'Electron framework' },
    'electron-rebuild': { name: 'Electron Rebuild', description: 'Electron rebuild library' },
    'chipmunk.client.toolkit': { name: 'ToolKit', description: 'Rendering library' },
    'chipmunk.plugin.ipc': { name: 'IPC', description: 'Chipmunk IPC  communication library' },
    'chipmunk-client-material': { name: 'Chipmunk Material', description: 'Chipmunk UI library' },
    'angular-core': { name: 'Angular', description: 'Angular Core' },
    'angular-material': { name: 'Angular Material', description: 'Angular Material Library' },
};

export function getDependenciesVersions(
    versions: IDependenciesList | IPC.IApplicationVersions,
): IDependencyVersion[] {
    const dependencies: IDependencyVersion[] = [];
    Object.keys(CDependencies).forEach((key: string) => {
        if ((versions as any)[key] === undefined) {
            return;
        }
        dependencies.push({
            name: CDependencies[key].name,
            description: CDependencies[key].description,
            version: (versions as any)[key],
        });
    });
    return dependencies;
}

export function getDependenciesStates(
    dependencies: CommonInterfaces.Versions.IDependencies,
): IDependencyState[] {
    const states: IDependencyState[] = [];
    Object.keys(CDependencies).forEach((key: string) => {
        if ((dependencies as any)[key] === undefined) {
            return;
        }
        states.push({
            name: CDependencies[key].name,
            description: CDependencies[key].description,
            depended: (dependencies as any)[key],
        });
    });
    return states;
}
