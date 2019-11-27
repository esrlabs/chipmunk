const addon = require("../native");
import { log } from "./logging";
import { AsyncResult, ITicks, INeonTransferChunk, INeonNotification, IChunk } from "./progress";
import { NativeEventEmitter, RustDltIndexerChannel, RustDltStatsChannel } from "./emitter";
import { TimeUnit } from "./units";
import { CancelablePromise } from './promise';

export interface DltFilterConf {
    min_log_level?: DltLogLevel;
    app_ids?: Array<string>;
    ecu_ids?: Array<string>;
    context_ids?: Array<string>;
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
    app_ids: Array<[string, LevelDistribution]>;
    context_ids: Array<[string, LevelDistribution]>;
    ecu_ids: Array<[string, LevelDistribution]>;
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
    dltFile: string;
    filterConfig: DltFilterConf;
    fibex?: string;
    tag: string;
    out: string;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}
export interface IIndexDltOptions {
    maxTime?: TimeUnit;
}
export interface IIndexDltOptionsChecked {
    maxTime: TimeUnit;
}
export interface IIndexDltCallbacks {
    onProgress: (ticks: ITicks) => any;
    onChunk: (chunk: IChunk) => any;
    onNotification: (notification: INeonNotification) => void;
}
export interface IStatsDltCallbacks {
    onProgress: (ticks: ITicks) => any;
    onConfig: (chunk: StatisticInfo) => any;
}

export function dltStatsAsync(
    dltFile     : string,
    callbacks   : IStatsDltCallbacks,
    options?    : IIndexDltOptions,
): CancelablePromise<void, void> {
    return new CancelablePromise<void, void>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            // Get defaults options
            const opt = getDefaultIndexDltProcessingOptions(options);
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                log(`Get command "break" operation. Starting breaking.`);
                clearTimeout(timeout);
                emitter.requestShutdown();
            });
            const channel = new RustDltStatsChannel(dltFile);
            const emitter = new NativeEventEmitter(channel);
            let total: number = 1;
            let timeout = setTimeout(function() {
                log("TIMED OUT ====> shutting down");
                emitter.requestShutdown();
            }, opt.maxTime.inMilliseconds());
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (chunk: StatisticInfo) => {
                if (!self.isProcessing()) {
                    log(`refuse to call "GotItem" because cancelation was called`);
                    return;
                }
                callbacks.onConfig(chunk);
            });
            emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
                if (!self.isProcessing()) {
                    log(`refuse to call "GotItem" because cancelation was called`);
                    return;
                }
                total = ticks.total;
                callbacks.onProgress(ticks);
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    callbacks.onProgress({ ellapsed: total, total });
                    cancel();
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, (n: INeonNotification) => {
                log("dltStats: we got a notification: " + JSON.stringify(n));
            });
            emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    callbacks.onProgress({ ellapsed: total, total });
                    resolve();
                });
            });
        } catch (err) {
            if (!(err instanceof Error)) {
                log(`operation is stopped. Error isn't valid:`);
                log(err);
                err = new Error(`operation is stopped. Error isn't valid.`);
            } else {
                log(`operation is stopped due error: ${err.message}`);
            }
            // Operation is rejected
            reject(err);
        }
    });
}

export type TIndexDltAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TIndexDltAsyncEventChunk = (event: IChunk) => void;
export type TIndexDltAsyncEventProgress = (event: ITicks) => void;
export type TIndexDltAsyncEventNotification = (event: INeonNotification) => void;
export type TIndexDltAsyncEventCB = TIndexDltAsyncEventChunk | TIndexDltAsyncEventProgress | TIndexDltAsyncEventNotification;

export function indexDltAsync(
    params      : IIndexDltParams,
    callbacks   : IIndexDltCallbacks,
    options?    : IIndexDltOptions,
): CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventCB> {
    return new CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventCB>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            log(`using fibex: ${params.fibex}`);
            // Get defaults options
            const opt = getDefaultIndexDltProcessingOptions(options);
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                log(`Get command "break" operation. Starting breaking.`);
                clearTimeout(timeout);
                emitter.requestShutdown();
            });
            // Create channel
            const channel = new RustDltIndexerChannel(
                params.dltFile,
                params.tag,
                params.out,
                params.append,
                params.chunk_size,
                params.filterConfig,
                params.fibex
            );
            // Create emitter
            const emitter: NativeEventEmitter = new NativeEventEmitter(channel);
            let chunks: number = 0;
            // Set timeout
            let timeout = setTimeout(function() {
                log("TIMED OUT ====> shutting down");
                // Because of timeout manually cancel (break) promise
                self.abort();
            }, opt.maxTime.inMilliseconds());
            // Add listenters
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
                if (!self.isProcessing()) {
                    log(`refuse to call "GotItem" because cancelation was called`);
                    return;
                }
                callbacks.onChunk({
                    bytesStart: c.b[0],
                    bytesEnd: c.b[1],
                    rowsStart: c.r[0],
                    rowsEnd: c.r[1],
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
                if (!self.isProcessing()) {
                    log(`refuse to call "Progress" because cancelation was called`);
                    return;
                }
                callbacks.onProgress(ticks);
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                log("we got a stopped event after " + chunks + " chunks");
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    log("shutdown completed");
                    // Operation is canceled.
                    cancel();
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, (n: INeonNotification) => {
                if (!self.isProcessing()) {
                    log(`refuse to call "Notification" because cancelation was called`);
                    return;
                }
                callbacks.onNotification(n);
            });
            emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
                log("we got a finished event " + chunks + " chunks");
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    log("shutdown completed");
                    // Operation is done.
                    resolve();
                });
            });
            // Handle finale of promise
            self.finally(() => {
                log("processing dlt indexing is finished");
            });
        } catch (err) {
            if (!(err instanceof Error)) {
                log(`operation is stopped. Error isn't valid:`);
                log(err);
                err = new Error(`operation is stopped. Error isn't valid.`);
            } else {
                log(`operation is stopped due error: ${err.message}`);
            }
            // Operation is rejected
            reject(err);
        }
    });
}

function getDefaultIndexDltProcessingOptions(options: IIndexDltOptions | undefined): IIndexDltOptionsChecked {
    if (typeof options !== 'object' || options === null) {
        options = {};
    }
    options.maxTime = options.maxTime instanceof TimeUnit ? options.maxTime : TimeUnit.fromSeconds(60);
    return options as IIndexDltOptionsChecked;
}
