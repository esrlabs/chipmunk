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
export interface IIndexDltProcessingOptions {
    maxTime?: TimeUnit;
}
export interface IIndexDltProcessingOptionsChecked {
    maxTime: TimeUnit;
}
export interface IIndexDltProcessingCallbacks {
    onProgress: (ticks: ITicks) => any;
    onChunk: (chunk: IChunk) => any;
    onNotification: (notification: INeonNotification) => void;
}
export function dltStatsAsync(
    dltFile: string,
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

export interface IMapItem { bytesStart: number; bytesEnd: number; rowsStart: number; rowsEnd: number; };
export type TIndexDltAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TIndexDltAsyncEventChunk = (event: { bytesStart: number, bytesEnd: number, rowsStart: number, rowsEnd: number }) => void;
export type TIndexDltAsyncEventProgress = (event: ITicks) => void;
export type TIndexDltAsyncEventNotification = (event: INeonNotification) => void;
export type TIndexDltAsyncEventCB = TIndexDltAsyncEventChunk | TIndexDltAsyncEventProgress | TIndexDltAsyncEventNotification;

export function indexDltAsync(
    params      : IIndexDltParams,
    callbacks   : IIndexDltProcessingCallbacks,
    options?    : IIndexDltProcessingOptions,
): CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventCB> {
    return new CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventCB>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            log(`using fibex: ${params.fibex}`);
            // Get defaults options
            const opt = getDefaultIndexDltProcessingOptions(options);
            // Add cancel callback
            refCancelCB(() => {
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
                self.break();
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

/*
export function indexDltAsync1(
    { dltFile, filterConfig, fibex, tag, out, chunk_size, append, stdout, statusUpdates }: IIndexDltParams,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => any,
    onChunk: (chunk: IChunk) => any,
    onNotification: (notification: INeonNotification) => void,
): [Promise<AsyncResult>, () => void] {
    log(`using fibex: ${fibex}`);
    const channel = new RustDltIndexerChannel(dltFile, tag, out, append, chunk_size, filterConfig, fibex);
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        let chunks: number = 0;
        let timeout = setTimeout(function() {
            log("TIMED OUT ====> shutting down");
            emitter.requestShutdown();
        }, maxTime.inMilliseconds());
        emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
            onChunk({
                bytesStart: c.b[0],
                bytesEnd: c.b[1],
                rowsStart: c.r[0],
                rowsEnd: c.r[1],
            });
        });
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
                resolve(AsyncResult.Completed); // Here is final => no more any events will be triggered
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
*/
function getDefaultIndexDltProcessingOptions(options: IIndexDltProcessingOptions | undefined): IIndexDltProcessingOptionsChecked {
    if (typeof options !== 'object' || options === null) {
        options = {};
    }
    options.maxTime = options.maxTime instanceof TimeUnit ? options.maxTime : TimeUnit.fromSeconds(60);
    return options as IIndexDltProcessingOptionsChecked;
}
