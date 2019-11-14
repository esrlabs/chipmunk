const addon = require("../native");
import { log } from "./logging";
import {
    AsyncResult,
    ITicks,
    INeonNotification,
    IConcatenatorResult,
    IMergerItemOptions,
    INeonTransferChunk,
    IChunk,
} from "./progress";
import { NativeEventEmitter, RustConcatenatorChannel, RustMergerChannel } from "./emitter";
import { TimeUnit } from "./units";

export interface IMergeParams {
    configFile: string;
    out: string;
    chunk_size?: number;
    append: boolean;
    stdout: boolean;
    statusUpdates: boolean;
}
export interface ConcatenatorInput {
    path: string;
    tag: string;
}
export interface IConcatFilesParams {
    configFile: string;
    out: string;
    append: boolean;
}

export function mergeFilesAsync(
    config: Array<IMergerItemOptions>,
    outFile: string,
    append: boolean,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => void,
    onResult: (res: IChunk) => void,
    onNotification: (notification: INeonNotification) => void,
    chunk_size?: number,
): [Promise<AsyncResult>, () => void] {
    log(`mergeFilesAsync called with config: ${JSON.stringify(config)}`);
    const channel = new RustMergerChannel(
        config,
        outFile,
        append,
        chunk_size !== undefined ? chunk_size : 5000,
    );
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        try {
            let totalTicks = 1;
            let timeout = setTimeout(function() {
                log("TIMED OUT ====> shutting down");
                emitter.requestShutdown();
            }, maxTime.inMilliseconds());
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
                onResult({
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
            emitter.on(NativeEventEmitter.EVENTS.Error, () => {
                emitter.requestShutdown();
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    resolve(AsyncResult.Aborted);
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, onNotification);
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
        } catch (error) {
            log("caught error: " + JSON.stringify(error));
            reject(error);
        }
    });
    return [
        p,
        () => {
            log("cancel called");
            emitter.requestShutdown();
        },
    ];
}

export function concatFilesAsync(
    config: Array<ConcatenatorInput>,
    outFile: string,
    append: boolean,
    chunkSize: number,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => any,
    onResult: (res: IChunk) => any,
    onNotification: (notification: INeonNotification) => void,
): [Promise<AsyncResult>, () => void] {
    const channel = new RustConcatenatorChannel(config, outFile, append, chunkSize);
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        try {
            let totalTicks = 1;
            let timeout = setTimeout(function() {
                log("TIMED OUT ====> shutting down");
                emitter.requestShutdown();
            }, maxTime.inMilliseconds());
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
                onResult({
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
            emitter.on(NativeEventEmitter.EVENTS.Error, () => {
                emitter.requestShutdown();
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                clearTimeout(timeout);
                emitter.shutdownAcknowledged(() => {
                    resolve(AsyncResult.Aborted);
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, onNotification);
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
        } catch (error) {
            log("caught error: " + JSON.stringify(error));
            reject(error);
        }
    });
    return [
        p,
        () => {
            log("cancel called");
            emitter.requestShutdown();
        },
    ];
}
