import { IPreset, IBundle, IFibex } from '../../../common/ipc/electron.ipc.messages';
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
    recentCommands: string[];
    recentDLTConnectorSettings: IConnectionOptions[];
    recentDateTimeFormats: string[];
    recentPresets: IPreset[];
    recentBundles: IBundle[];
    pluginDefaultUninstalled: string[];
    recentDLTTimeZone: string;
    fibexDLT: IFibex[];
}

export const defaults: IStorage = {
    recentFiles: [],
    recentFiltersFiles: [],
    recentSearchRequests: [],
    recentCommands: [],
    recentDLTConnectorSettings: [],
    recentDateTimeFormats: [],
    recentPresets: [],
    recentBundles: [],
    pluginDefaultUninstalled: [],
    recentDLTTimeZone: '',
    fibexDLT: [],
};
