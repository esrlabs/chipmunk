import {
    indexAsync,
    IIndexerParams,
    detectTimestampInString,
    detectTimestampFormatInFile,
    detectTimestampFormatsInFiles,
    IFilePath,
} from "./processor";
import { TimeUnit } from "./units";
export { TimeUnit };
import {
    IConcatFilesParams,
    IMergeParams,
    mergeFiles,
    concatFilesAsync,
    ConcatenatorInput,
} from "./merger";
import { IIndexDltParams, dltStatsAsync, indexDltAsync, DltFilterConf } from "./dlt";
import {
    ITicks,
    AsyncResult,
    IChunk,
    INeonTransferChunk,
    INeonNotification,
    Severity,
    IConcatenatorResult,
} from "./progress";
export {
    ITicks,
    DltFilterConf,
    IChunk,
    AsyncResult,
    INeonNotification,
    INeonTransferChunk,
    Severity,
    IIndexDltParams,
    ConcatenatorInput,
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
    app_ids: Array<[String, LevelDistribution]>;
    context_ids: Array<[String, LevelDistribution]>;
    ecu_ids: Array<[String, LevelDistribution]>;
}

export interface IChipmunkIndexer {
    indexAsync: (
        chunkSize: number,
        fileToIndex: string,
        maxTime: TimeUnit,
        outPath: string,
        onProgress: (ticks: ITicks) => any,
        onChunk: (chunk: INeonTransferChunk) => any,
        onNotification: (notification: INeonNotification) => void,
        tag: string,
    ) => [Promise<AsyncResult>, () => void];
    mergeFiles: (params: IMergeParams) => boolean;
    concatFilesAsync: (
        config: Array<ConcatenatorInput>,
        outFile: string,
        append: boolean,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => void,
        onResult: (res: IConcatenatorResult) => void,
        onNotification: (notification: INeonNotification) => void,
    ) => [Promise<AsyncResult>, () => void];
    dltStatsAsync: (
        dltFile: String,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => any,
        onConfig: (chunk: StatisticInfo) => any,
    ) => [Promise<AsyncResult>, () => void];
    indexDltAsync: (
        params: IIndexDltParams,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => any,
        onChunk: (chunk: INeonTransferChunk) => any,
        onNotification: (notification: INeonNotification) => void,
    ) => [Promise<AsyncResult>, () => void];
    detectTimestampInString: (input: string) => string;
    detectTimestampFormatInFile: (input: string) => string;
    detectTimestampFormatsInFiles: (conf: Array<IFilePath>) => string;
}

const library: IChipmunkIndexer = {
    indexAsync,
    mergeFiles,
    concatFilesAsync,
    dltStatsAsync,
    indexDltAsync,
    detectTimestampInString,
    detectTimestampFormatInFile,
    detectTimestampFormatsInFiles,
};
export { library as indexer };
