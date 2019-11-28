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

export type TDltStatsEvents = 'config' | 'progress' | 'notification';
export type TDltStatsEventConfig = (event: StatisticInfo) => void;
export type TDltStatsEventProgress = (event: ITicks) => void;
export type TDltStatsEventNotification = (event: INeonNotification) => void;
export type TDltStatsEventObject = TDltStatsEventConfig | TDltStatsEventProgress | TDltStatsEventNotification;

export function dltStatsAsync(
    dltFile     : string,
    options?    : IIndexDltOptions,
): CancelablePromise<void, void, TDltStatsEvents, TDltStatsEventObject> {
    return new CancelablePromise<void, void, TDltStatsEvents, TDltStatsEventObject>((resolve, reject, cancel, refCancelCB, self) => {
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
                self.emit('config', chunk);
            });
            emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
                total = ticks.total;
                self.emit('progress', ticks);
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    cancel();
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
                log("dltStats: we got a notification: " + JSON.stringify(notification));
                self.emit('notification', notification);
            });
            emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    self.emit('progress', { ellapsed: total, total });
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
export type TIndexDltAsyncEventObject = TIndexDltAsyncEventChunk | TIndexDltAsyncEventProgress | TIndexDltAsyncEventNotification;

export function indexDltAsync(
    params      : IIndexDltParams,
    options?    : IIndexDltOptions,
): CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventObject> {
    return new CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventObject>((resolve, reject, cancel, refCancelCB, self) => {
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
                self.emit('chunk', {
                    bytesStart: c.b[0],
                    bytesEnd: c.b[1],
                    rowsStart: c.r[0],
                    rowsEnd: c.r[1],
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
                self.emit('progress', ticks);
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
            emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
                self.emit('notification', notification);
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
