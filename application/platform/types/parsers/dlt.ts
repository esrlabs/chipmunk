export const FILTER_LEVELS = {
    app_ids: 'app_ids',
    context_ids: 'context_ids',
    ecu_ids: 'ecu_ids',
};
export interface IDLTFilters {
    app_ids?: string[];
    context_ids?: string[];
    ecu_ids?: string[];
}

export interface IDLTOptions {
    logLevel: number;
    filters: IDLTFilters;
    fibex: string[];
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
}

export enum DltLogLevel {
    Fatal = 0x1 << 4,
    Error = 0x2 << 4,
    Warn = 0x3 << 4,
    Info = 0x4 << 4,
    Debug = 0x5 << 4,
    Verbose = 0x6 << 4,
}

export const DltLogLevelNames = {
    1: 'Fatal',
    2: 'Error',
    3: 'Warn',
    4: 'Info',
    5: 'Debug',
    6: 'Verbose',
};

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

export enum EMTIN {
    // If MSTP == DLT_TYPE_LOG
    DLT_LOG_FATAL = 'DLT_LOG_FATAL',
    DLT_LOG_ERROR = 'DLT_LOG_ERROR',
    DLT_LOG_WARN = 'DLT_LOG_WARN',
    DLT_LOG_INFO = 'DLT_LOG_INFO',
    DLT_LOG_DEBUG = 'DLT_LOG_DEBUG',
    DLT_LOG_VERBOSE = 'DLT_LOG_VERBOSE',
    // If MSTP == DLT_TYPE_APP_TRACE
    DLT_TRACE_VARIABLE = 'DLT_TRACE_VARIABLE',
    DLT_TRACE_FUNCTION_IN = 'DLT_TRACE_FUNCTION_IN',
    DLT_TRACE_FUNCTION_OUT = 'DLT_TRACE_FUNCTION_OUT',
    DLT_TRACE_STATE = 'DLT_TRACE_STATE',
    DLT_TRACE_VFB = 'DLT_TRACE_VFB',
    // If MSTP == DLT_TYPE_NW_TRACE
    DLT_NW_TRACE_IPC = 'DLT_NW_TRACE_IPC',
    DLT_NW_TRACE_CAN = 'DLT_NW_TRACE_CAN',
    DLT_NW_TRACE_FLEXRAY = 'DLT_NW_TRACE_FLEXRAY',
    DLT_NW_TRACE_MOST = 'DLT_NW_TRACE_MOST',
    // If MSTP == DLT_TYPE_CONTROL
    DLT_CONTROL_REQUEST = 'DLT_CONTROL_REQUEST',
    DLT_CONTROL_RESPONSE = 'DLT_CONTROL_RESPONSE',
    DLT_CONTROL_TIME = 'DLT_CONTROL_TIME',
    // Default
    UNDEFINED = 'UNDEFINED',
}

export interface DltFilterConf {
    min_log_level: DltLogLevel | undefined;
    app_ids: Array<string> | undefined;
    ecu_ids: Array<string> | undefined;
    context_ids: Array<string> | undefined;
    app_id_count: number;
    context_id_count: number;
}

export interface DltParserSettings {
    filter_config: DltFilterConf | undefined;
    fibex_file_paths: Array<string> | undefined;
    with_storage_header: boolean;
}

export function optionsToParserSettings(
    options: IDLTOptions,
    with_storage_header: boolean,
    app_id_count: number,
    context_id_count: number,
): DltParserSettings {
    const filter_config: DltFilterConf = {
        min_log_level: options.logLevel,
        app_ids: (options.filters as any)[FILTER_LEVELS.app_ids],
        context_ids: (options.filters as any)[FILTER_LEVELS.context_ids],
        ecu_ids: (options.filters as any)[FILTER_LEVELS.ecu_ids],
        app_id_count,
        context_id_count,
    };
    return {
        filter_config,
        fibex_file_paths: options.fibex.length > 0 ? options.fibex : undefined,
        with_storage_header,
    };
}

export function defaultParserSettings(with_storage_header: boolean): DltParserSettings {
    return {
        filter_config: undefined,
        fibex_file_paths: undefined,
        with_storage_header,
    };
}

export function getLogLevelName(level: number): string {
    const name = (DltLogLevelNames as any)[level];
    return name === undefined ? 'unknown' : name;
}

export const LOG_LEVELS: { [key: string]: number } = {
    [EMTIN.DLT_LOG_FATAL]: 1,
    [EMTIN.DLT_LOG_ERROR]: 2,
    [EMTIN.DLT_LOG_WARN]: 3,
    [EMTIN.DLT_LOG_INFO]: 4,
    [EMTIN.DLT_LOG_DEBUG]: 5,
    [EMTIN.DLT_LOG_VERBOSE]: 6,
};

export const NUM_LOGS_LEVELS: { [key: number]: string } = {
    [1]: EMTIN.DLT_LOG_FATAL,
    [2]: EMTIN.DLT_LOG_ERROR,
    [3]: EMTIN.DLT_LOG_WARN,
    [4]: EMTIN.DLT_LOG_INFO,
    [5]: EMTIN.DLT_LOG_DEBUG,
    [6]: EMTIN.DLT_LOG_VERBOSE,
};
