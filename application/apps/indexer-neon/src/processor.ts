const addon = require("../native");
import { log } from "./logging";
import { AsyncResult, ITicks, IChunk } from "./progress";
import { NativeEventEmitter, RustIndexerChannel } from "./emitter";

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
    maxTime: number,
    outPath: string,
    onProgress: (ticks: ITicks) => any,
    onChunk: (chunk: IChunk) => any,
    tag: string,
): Promise<AsyncResult> {
    return new Promise<AsyncResult>((resolve, reject) => {
        let chunks: number = 0;
        const append = false; // TODO support append option
        const timestamps = false; // TODO support timestamps option
        const channel = new RustIndexerChannel(fileToIndex, tag, outPath, append, timestamps, chunkSize);
        const emitter = new NativeEventEmitter(channel);
        let timeout = setTimeout(function() {
            log("TIMED OUT ====> shutting down");
            emitter.requestShutdown();
        }, maxTime);
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
        emitter.on(NativeEventEmitter.EVENTS.Error, (e: any) => {
            log("we got an error: " + e);
            clearTimeout(timeout);
            emitter.requestShutdown();
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
