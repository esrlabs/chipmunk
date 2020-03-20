import { IDependencies } from './interface.versions';

export interface IHistory {
    url: string;
    version: string;
    hash: string;
    phash: string;
}

export interface IPlugin {
    name: string;
    url: string;
    version: string;
    hash: string;
    phash: string;
    default: boolean;
    signed: boolean;
    dependencies: IDependencies;
    display_name: string;
    description: string;
    readme: string;
    icon: string;
    file: string;
    history: IHistory[];
}
