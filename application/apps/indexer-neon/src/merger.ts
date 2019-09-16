const addon = require("../native");

export interface IMergeParams {
    configFile: String;
    out: String;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}
export interface IConcatFilesParams {
    configFile: String;
    out: String;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}

export function mergeFiles({
    configFile,
    out,
    chunk_size,
    append,
    stdout,
    statusUpdates,
}: IMergeParams) {
    return addon.mergeFiles(
        configFile,
        out,
        chunk_size !== undefined ? chunk_size : 5000,
        append,
        stdout,
        statusUpdates,
    );
}

export function concatFiles({
    configFile,
    out,
    chunk_size,
    append,
    stdout,
    statusUpdates,
}: IConcatFilesParams) {
    return addon.concatFiles(
        configFile,
        out,
        chunk_size !== undefined ? chunk_size : 5000,
        append,
        stdout,
        statusUpdates,
    );
}
