
import { CommonInterfaces } from '../../interfaces/interface.common';

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

export const CDependencies = {
    'electron': { name: 'Electron', description: 'Electron framework' },
    'electron-rebuild': { name: 'Electron Rebuild', description: 'Electron rebuild library' },
    'chipmunk.client.toolkit': { name: 'ToolKit', description: 'Rendering library' },
    'chipmunk.plugin.ipc': { name: 'IPC', description: 'Chipmunk IPC  communication library' },
    'chipmunk-client-material': { name: 'Chipmunk Material', description: 'Chipmunk UI library' },
    'angular-core': { name: 'Angular', description: 'Angular Core' },
    'angular-material': { name: 'Angular Material', description: 'Angular Material Library' },
};

export function getDependenciesVersions(versions: { [key: string]: string } | CommonInterfaces.Versions.IVersions): IDependencyVersion[] {
    const dependencies: IDependencyVersion[] = [];
    Object.keys(CDependencies).forEach((key: string) => {
        if (versions[key] === undefined) {
            return;
        }
        dependencies.push({
            name: CDependencies[key].name,
            description: CDependencies[key].description,
            version: versions[key],
        });
    });
    return dependencies;
}

export function getDependenciesStates(dependencies: { [key: string]: string } | CommonInterfaces.Versions.IDependencies): IDependencyState[] {
    const states: IDependencyState[] = [];
    Object.keys(CDependencies).forEach((key: string) => {
        if (dependencies[key] === undefined) {
            return;
        }
        states.push({
            name: CDependencies[key].name,
            description: CDependencies[key].description,
            depended: dependencies[key],
        });
    });
    return states;
}
