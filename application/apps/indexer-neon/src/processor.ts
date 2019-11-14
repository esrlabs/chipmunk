const addon = require("../native");
import { log } from "./logging";
import {
    AsyncResult,
    ITicks,
    INeonTransferChunk,
    INeonNotification,
    ITimestampFormatResult,
    IDiscoverItem,
    IChunk,
} from "./progress";
import { NativeEventEmitter, RustIndexerChannel, RustTimestampChannel } from "./emitter";
import { TimeUnit } from "./units";

export interface IIndexerParams {
    file: string;
    tag: string;
    out: string;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    timestamps: boolean;
    statusUpdates: boolean;
}
export interface IFilePath {
    path: string;
}

export function discoverTimespanAsync(
    filesToDiscover: Array<IDiscoverItem>,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => any,
    onChunk: (chunk: ITimestampFormatResult) => any,
    onNotification: (notification: INeonNotification) => void,
): [Promise<AsyncResult>, () => void] {
    const channel = new RustTimestampChannel(filesToDiscover);
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        let totalTicks = 1;
        let timeout = setTimeout(function() {
            log("TIMED OUT ====> shutting down");
            emitter.requestShutdown();
        }, maxTime.inMilliseconds());
        emitter.on(NativeEventEmitter.EVENTS.GotItem, onChunk);
        emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
            totalTicks = ticks.total;
            onProgress(ticks);
        });
        emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                resolve(AsyncResult.Aborted);
            });
        });
        emitter.on(NativeEventEmitter.EVENTS.Notification, (n: INeonNotification) => {
            onNotification(n);
        });
        emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
            onProgress({
                ellapsed: totalTicks,
                total: totalTicks,
            });
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
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
export function indexAsync(
    chunkSize: number,
    fileToIndex: string,
    maxTime: TimeUnit,
    outPath: string,
    onProgress: (ticks: ITicks) => any,
    onChunk: (chunk: IChunk) => any,
    onNotification: (notification: INeonNotification) => void,
    tag: string,
): [Promise<AsyncResult>, () => void] {
    const append = false; // TODO support append option
    const timestamps = false; // TODO support timestamps option
    const channel = new RustIndexerChannel(
        fileToIndex,
        tag,
        outPath,
        append,
        timestamps,
        chunkSize,
    );
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        let totalTicks = 1;
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
        emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
            totalTicks = ticks.total;
            onProgress(ticks);
        });
        emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
            log("indexAsync: we got a stopped");
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                log("indexAsync: shutdown completed");
                resolve(AsyncResult.Aborted);
            });
        });
        emitter.on(NativeEventEmitter.EVENTS.Notification, (n: INeonNotification) => {
            log("indexAsync: we got a notification: " + JSON.stringify(n));
            onNotification(n);
        });
        emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
            log("indexAsync: we got a finished event");
            onProgress({
                ellapsed: totalTicks,
                total: totalTicks,
            });
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                log("indexAsync: shutdown completed");
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

export function detectTimestampInString(input: string): string {
    return addon.detectTimestampInString(input);
}
export function detectTimestampFormatInFile(input: string): string {
    return addon.detectTimestampFormatInFile(input);
}
