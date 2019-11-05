const addon = require("../native");
import { log } from "./logging";
import { AsyncResult, ITicks, INeonTransferChunk, INeonNotification } from "./progress";
import { NativeEventEmitter, RustDltIndexerChannel, RustDltStatsChannel } from "./emitter";
import { TimeUnit } from "./units";

export interface DltFilterConf {
    min_log_level?: DltLogLevel;
    app_ids?: Array<String>;
    ecu_ids?: Array<String>;
    context_ids?: Array<String>;
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
    app_ids: Array<[String, LevelDistribution]>;
    context_ids: Array<[String, LevelDistribution]>;
    ecu_ids: Array<[String, LevelDistribution]>;
}
export enum DltLogLevel {
    Fatal = 0x1 << 4,
    Error = 0x2 << 4,
    Warn = 0x3 << 4,
    Info = 0x4 << 4,
    Debug = 0x5 << 4,
    Verbose = 0x6 << 4,
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
export function dltStatsAsync(
    dltFile: String,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => any,
    onConfig: (chunk: StatisticInfo) => any,
): [Promise<AsyncResult>, () => void] {
    const channel = new RustDltStatsChannel(dltFile);
    const emitter = new NativeEventEmitter(channel);
    let total: number = 1;
    const p = new Promise<AsyncResult>((resolve, reject) => {
        let timeout = setTimeout(function() {
            log("TIMED OUT ====> shutting down");
            emitter.requestShutdown();
        }, maxTime.inMilliseconds());
        emitter.on(NativeEventEmitter.EVENTS.GotItem, onConfig);
        emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
            total = ticks.total;
            onProgress(ticks);
        });
        emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                resolve(AsyncResult.Aborted);
                onProgress({ ellapsed: total, total });
            });
        });
        emitter.on(NativeEventEmitter.EVENTS.Notification, (n: INeonNotification) => {
            log("dltStats: we got a notification: " + JSON.stringify(n));
        });
        emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                resolve(AsyncResult.Completed);
                onProgress({ ellapsed: total, total });
            });
        });
    });
    return [
        p,
        () => {
            log("cancel called");
            emitter.requestShutdown();
        },
    ];
}
export function indexDltAsync(
    { dltFile, filterConfig, tag, out, chunk_size, append, stdout, statusUpdates }: IIndexDltParams,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => any,
    onChunk: (chunk: INeonTransferChunk) => any,
    onNotification: (notification: INeonNotification) => void,
): [Promise<AsyncResult>, () => void] {
    const channel = new RustDltIndexerChannel(dltFile, tag, out, append, chunk_size, filterConfig);
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        let chunks: number = 0;
        let timeout = setTimeout(function() {
            log("TIMED OUT ====> shutting down");
            emitter.requestShutdown();
        }, maxTime.inMilliseconds());
        emitter.on(NativeEventEmitter.EVENTS.GotItem, onChunk);
        emitter.on(NativeEventEmitter.EVENTS.Progress, onProgress);
        emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
            log("we got a stopped event after " + chunks + " chunks");
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                log("shutdown completed");
                resolve(AsyncResult.Aborted);
            });
        });
        emitter.on(NativeEventEmitter.EVENTS.Notification, (n: INeonNotification) => {
            onNotification(n);
        });
        emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
            log("we got a finished event " + chunks + " chunks");
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                log("shutdown completed");
                resolve(AsyncResult.Completed);
            });
        });
    });
    return [
        p,
        () => {
            log("cancel called");
            emitter.requestShutdown();
        },
    ];
}
