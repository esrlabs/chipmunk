import {
    indexFile,
    indexAsync,
    IIndexerParams,
    detectTimestampInString,
    detectTimestampFormatInFile,
    detectTimestampFormatsInFiles,
    IFilePath,
} from "./processor";
import { TimeUnit } from "./units";
export { TimeUnit };
import { IConcatFilesParams, IMergeParams, mergeFiles, concatFiles } from "./merger";
import {
    IIndexDltParams,
    dltStats,
    dltStatsAsync,
    indexDltFile,
    indexDltAsync,
    DltFilterConf,
} from "./dlt";
import { ITicks, AsyncResult, IChunk, INeonTransferChunk } from "./progress";
export { ITicks, DltFilterConf, IChunk };

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
        maxTime: TimeUnit,
        outPath: string,
        onProgress: (ticks: ITicks) => any,
        onChunk: (chunk: INeonTransferChunk) => any,
        tag: string,
    ) => Promise<AsyncResult>;
    mergeFiles: (params: IMergeParams) => boolean;
    concatFiles: (params: IConcatFilesParams) => boolean;
    dltStats: (dltFile: String) => StatisticInfo;
    dltStatsAsync: (
        dltFile: String,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => any,
        onConfig: (chunk: StatisticInfo) => any,
    ) => Promise<AsyncResult>;
    indexDltFile: (params: IIndexDltParams) => boolean;
    indexDltAsync: (
        params: IIndexDltParams,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => any,
        onChunk: (chunk: INeonTransferChunk) => any,
    ) => Promise<AsyncResult>;
    detectTimestampInString: (input: string) => string;
    detectTimestampFormatInFile: (input: string) => string;
    detectTimestampFormatsInFiles: (conf: Array<IFilePath>) => string;
}

const library: IChipmunkIndexer = {
    indexFile,
    indexAsync,
    mergeFiles,
    concatFiles,
    dltStats,
    dltStatsAsync,
    indexDltFile,
    indexDltAsync,
    detectTimestampInString,
    detectTimestampFormatInFile,
    detectTimestampFormatsInFiles,
};
export {library as indexer};
