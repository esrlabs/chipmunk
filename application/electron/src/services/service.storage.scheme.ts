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
    filters: number;
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
}

export const defaults: IStorage = {
    recentFiles: [],
    recentFiltersFiles: [],
    recentSearchRequests: [],
    recentDLTConnectorSettings: [],
};
