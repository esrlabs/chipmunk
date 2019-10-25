const addon = require("../native");
import { log } from "./logging";
import { AsyncResult, ITicks, IChunk, INeonTransferChunk } from "./progress";
import { NativeEventEmitter, RustIndexerChannel } from "./emitter";
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

export function indexAsync(
    chunkSize: number,
    fileToIndex: string,
    maxTime: TimeUnit,
    outPath: string,
    onProgress: (ticks: ITicks) => any,
    onChunk: (chunk: INeonTransferChunk) => any,
    tag: string,
): Promise<AsyncResult> {
    return new Promise<AsyncResult>((resolve, reject) => {
        const append = false; // TODO support append option
        const timestamps = false; // TODO support timestamps option
        let totalTicks = 1;
        const channel = new RustIndexerChannel(
            fileToIndex,
            tag,
            outPath,
            append,
            timestamps,
            chunkSize,
        );
        const emitter = new NativeEventEmitter(channel);
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
            log("indexAsync: we got a stopped");
            clearTimeout(timeout);
            emitter.shutdownAcknowledged(() => {
                log("indexAsync: shutdown completed");
                resolve(AsyncResult.Aborted);
            });
        });
        emitter.on(NativeEventEmitter.EVENTS.Error, (e: any) => {
            log("indexAsync: we got an error: " + e);
            clearTimeout(timeout);
            emitter.requestShutdown();
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
}
export function indexFile({
    file,
    tag,
    out,
    chunk_size,
    append,
    stdout,
    timestamps,
    statusUpdates,
}: IIndexerParams) {
    return addon.indexFile(
        file,
        tag,
        out,
        chunk_size !== undefined ? chunk_size : 5000,
        append,
        stdout,
        timestamps,
        statusUpdates,
    );
}

export function detectTimestampInString(input: string): string {
    return addon.detectTimestampInString(input);
}
export function detectTimestampFormatInFile(input: string): string {
    return addon.detectTimestampFormatInFile(input);
}
export function detectTimestampFormatsInFiles(conf: Array<IFilePath>): string {
    return addon.detectTimestampFormatsInFiles(conf);
}
