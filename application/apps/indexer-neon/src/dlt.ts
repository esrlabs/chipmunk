const addon = require("../native");

export interface DltFilterConf {
    min_log_level?: number;
    app_ids?: Array<String>;
    ecu_ids?: Array<String>;
    context_ids?: Array<String>;
}
export interface IIndexDltParams {
    dltFile: String;
    filterConfig?: DltFilterConf;
    tag: String;
    out: String;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}
export function dltStats(dltFile: String) {
    return addon.dltStats(dltFile);
}
export function indexDltFile({
    dltFile,
    filterConfig,
    tag,
    out,
    chunk_size,
    append,
    stdout,
    statusUpdates,
}: IIndexDltParams) {
    const usedChunkSize = chunk_size !== undefined ? chunk_size : 5000;
    if (filterConfig === undefined) {
        return addon.indexDltFile(dltFile, tag, out, usedChunkSize, append, stdout, statusUpdates);
    } else {
        return addon.indexDltFile(
            dltFile,
            tag,
            out,
            usedChunkSize,
            append,
            stdout,
            statusUpdates,
            filterConfig,
        );
    }
}
