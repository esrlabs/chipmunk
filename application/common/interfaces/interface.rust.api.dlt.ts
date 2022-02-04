export enum DltLogLevel {
    Fatal = 0x1 << 4,
    Error = 0x2 << 4,
    Warn = 0x3 << 4,
    Info = 0x4 << 4,
    Debug = 0x5 << 4,
    Verbose = 0x6 << 4,
}

export interface DltParserFilterConfig {
    min_log_level: DltLogLevel | undefined;
    app_ids: Array<string> | undefined;
    ecu_ids: Array<string> | undefined;
    context_ids: Array<string> | undefined;
    app_id_count: number;
    context_id_count: number;
}

export interface DltParserSettings {
    filter_config: DltParserFilterConfig | undefined;
    fibex_file_paths: Array<string> | undefined;
    with_storage_header: boolean;
}

export interface PcapParserSettings {
    dlt: DltParserSettings;
}
