export interface IDLTFilters {
    [key: string]: string[];
}

export interface IDLTOptions {
    logLevel: number;
    filters: IDLTFilters;
    stats?: StatisticInfo;
    fibex: IFibexConfig;
    fibexFilesInfo?: Array<{
        name: string;
        path: string;
        size: number;
        created: number;
        changed: number;
    }>;
    tz?: string;
}

export interface IIndexDltParams {
    dltFile: string;
    filterConfig: DltFilterConf;
    fibex: IFibexConfig;
    tag: string;
    out: string;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
    formatOptions: {
        tz?: string;
    };
}

export interface DltFilterConf {
    min_log_level?: DltLogLevel;
    app_ids?: Array<string>;
    ecu_ids?: Array<string>;
    context_ids?: Array<string>;
    app_id_count: number;
    context_id_count: number;
}

export enum DltLogLevel {
    Fatal = 0x1 << 4,
    Error = 0x2 << 4,
    Warn = 0x3 << 4,
    Info = 0x4 << 4,
    Debug = 0x5 << 4,
    Verbose = 0x6 << 4,
}

export interface LevelDistribution {
    non_log: number;
    log_fatal: number;
    log_error: number;
    log_warning: number;
    log_info: number;
    log_debug: number;
    log_verbose: number;
    log_invalid: number;
}

export interface StatisticInfo {
    app_ids: Array<[string, LevelDistribution]>;
    context_ids: Array<[string, LevelDistribution]>;
    ecu_ids: Array<[string, LevelDistribution]>;
    contained_non_verbose: boolean;
}

export interface IFibexConfig {
    fibex_file_paths: Array<string>;
}
