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
}

export const defaults: IStorage = {
    recentFiles: [],
    recentFiltersFiles: [],
    recentSearchRequests: [],
};
