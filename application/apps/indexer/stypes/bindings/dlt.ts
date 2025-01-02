/**
 * ATTENTION:
 * THIS FILE IS MANUALLY CREATED BECAUSE `ts_rs` CANNOT BE APPLIED
 * TO FOREIGN TYPES (`DltFilterConfig` comes from the `dlt-core` crate).
 * DO NOT REMOVE THIS FILE.
 */
export interface DltFilterConfig {
    /// only select log entries with level MIN_LEVEL and more severe
    ///
    /// ``` text
    ///  1 => FATAL
    ///  2 => ERROR
    ///  3 => WARN
    ///  4 => INFO
    ///  5 => DEBUG
    ///  6 => VERBOSE
    /// ```    min_log_level?: number,
    /// what app ids should be allowed.
    app_ids?: string[];
    /// what ecu ids should be allowed
    ecu_ids?: string[];
    /// what context ids should be allowed
    context_ids?: string[];
    /// how many app ids exist in total
    app_id_count: number;
    /// how many context ids exist in total
    context_id_count: number;
}
