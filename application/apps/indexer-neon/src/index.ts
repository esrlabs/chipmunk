import {
    indexFile,
    indexAsync,
    IIndexerParams,
    detectTimestampInString,
    detectTimestampFormatInFile,
    detectTimestampFormatsInFiles,
    IFilePath,
    IChunk,
} from "./processor";
import { IConcatFilesParams, IMergeParams, mergeFiles, concatFiles } from "./merger";
import { IIndexDltParams, dltStats, indexDltFile } from "./dlt";

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
    app_ids: Array<[String, LevelDistribution]>;
    context_ids: Array<[String, LevelDistribution]>;
    ecu_ids: Array<[String, LevelDistribution]>;
}

export interface IChipmunkIndexer {
    indexFile: (params: IIndexerParams) => boolean;
    indexAsync: (
    chunkSize: number,
    fileToIndex: string,
    maxTime: number,
    outPath: string,
    onChunk: (chunk: IChunk) => any,
    tag: string,
) => Promise<boolean>,
    mergeFiles: (params: IMergeParams) => boolean;
    concatFiles: (params: IConcatFilesParams) => boolean;
    dltStats: (dltFile: String) => StatisticInfo;
    indexDltFile: (params: IIndexDltParams) => boolean;
    detectTimestampInString: (input: string) => string;
    detectTimestampFormatInFile: (input: string) => string;
    detectTimestampFormatsInFiles: (conf: Array<IFilePath>) => string;
}

export const library: IChipmunkIndexer = {
    indexFile,
    indexAsync,
    mergeFiles,
    concatFiles,
    dltStats,
    indexDltFile,
    detectTimestampInString,
    detectTimestampFormatInFile,
    detectTimestampFormatsInFiles,
};
