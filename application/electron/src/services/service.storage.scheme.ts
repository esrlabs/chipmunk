export interface IRecentFile {
    file: string;
    timestamp: number;
    size: number;
}

export interface IStorage {
    recentFiles: IRecentFile[];
}

export const defaults: IStorage = {
    recentFiles: [],
};
