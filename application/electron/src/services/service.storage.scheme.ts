import { IConnectionOptions } from '../controllers/connections/dlt.connection';

export { IConnectionOptions };

export interface IRecentFile {
    file: string;
    filename: string;
    folder: string;
    timestamp: number;
    size: number;
}

export interface IRecentFilterFile {
    file: string;
    filename: string;
    folder: string;
    timestamp: number;
    count: number;
}

export interface IRecentSearchRequest {
    request: string;
    used: number;
}

export interface IStorage {
    recentFiles: IRecentFile[];
    recentFiltersFiles: IRecentFilterFile[];
    recentSearchRequests: IRecentSearchRequest[];
    recentDLTConnectorSettings: IConnectionOptions[];
    recentDateTimeFormats: string[];
    pluginDefaultUninstalled: string[];
}

export const defaults: IStorage = {
    recentFiles: [],
    recentFiltersFiles: [],
    recentSearchRequests: [],
    recentDLTConnectorSettings: [],
    recentDateTimeFormats: [],
    pluginDefaultUninstalled: [],
};
