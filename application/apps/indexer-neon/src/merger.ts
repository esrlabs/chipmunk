const addon = require("../native");
import { log } from "./logging";
import {
    AsyncResult,
    ITicks,
    INeonNotification,
    IConcatenatorResult,
} from "./progress";
import { NativeEventEmitter, RustConcatenatorChannel } from "./emitter";
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

export function mergeFiles({
    configFile,
    out,
    chunk_size,
    append,
    stdout,
    statusUpdates,
}: IMergeParams) {
    return addon.mergeFiles(
        configFile,
        out,
        chunk_size !== undefined ? chunk_size : 5000,
        append,
        stdout,
        statusUpdates,
    );
}

export function concatFilesAsync(
    config: Array<ConcatenatorInput>,
    outFile: string,
    append: boolean,
    maxTime: TimeUnit,
    onProgress: (ticks: ITicks) => any,
    onResult: (res: IConcatenatorResult) => any,
    onNotification: (notification: INeonNotification) => void,
): [Promise<AsyncResult>, () => void] {
    const channel = new RustConcatenatorChannel(config, outFile, append);
    const emitter = new NativeEventEmitter(channel);
    const p = new Promise<AsyncResult>((resolve, reject) => {
        try {
            let totalTicks = 1;
            let timeout = setTimeout(function() {
                log("TIMED OUT ====> shutting down");
                emitter.requestShutdown();
            }, maxTime.inMilliseconds());
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (r: IConcatenatorResult) => {
                onResult(r);
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
