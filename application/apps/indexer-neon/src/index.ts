import {
    indexAsync,
    detectTimestampInString,
    detectTimestampFormatInFile,
    discoverTimespanAsync,
    IFilePath,
} from "./processor";
import { TimeUnit } from "./units";
export { TimeUnit };
import {
    mergeFilesAsync,
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
    IMergerItemOptions,
    IDiscoverItem,
    ITimestampFormatResult,
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
    IMergerItemOptions,
    ITimestampFormatResult,
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
        onChunk: (chunk: IChunk) => any,
        onNotification: (notification: INeonNotification) => void,
        tag: string,
    ) => [Promise<AsyncResult>, () => void];
    mergeFilesAsync: (
        config: Array<IMergerItemOptions>,
        outFile: string,
        append: boolean,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => void,
        onResult: (res: IChunk) => void,
        onNotification: (notification: INeonNotification) => void,
        chunk_size?: number,
    ) => [Promise<AsyncResult>, () => void];
    concatFilesAsync: (
        config: Array<ConcatenatorInput>,
        outFile: string,
        append: boolean,
        chunkSize: number,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => void,
        onResult: (res: IChunk) => void,
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
        onChunk: (chunk: IChunk) => any,
        onNotification: (notification: INeonNotification) => void,
    ) => [Promise<AsyncResult>, () => void];
    detectTimestampInString: (input: string) => string;
    detectTimestampFormatInFile: (input: string) => string;
    discoverTimespanAsync: (
        filesToDiscover: Array<IDiscoverItem>,
        maxTime: TimeUnit,
        onProgress: (ticks: ITicks) => any,
        onChunk: (chunk: ITimestampFormatResult) => any,
        onNotification: (notification: INeonNotification) => void,
    ) => [Promise<AsyncResult>, () => void];
}

const library: IChipmunkIndexer = {
    indexAsync,
    mergeFilesAsync,
    concatFilesAsync,
    dltStatsAsync,
    indexDltAsync,
    detectTimestampInString,
    detectTimestampFormatInFile,
    discoverTimespanAsync,
};
export { library as indexer };
