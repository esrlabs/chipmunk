import { log } from "./logging";
import { AsyncResult, ITicks } from "./progress";
const { promisify } = require("util");
const { REventEmitter: RustChannel } = require("../native/index.node");
const addon = require("../native");
const { EventEmitter } = require("events");

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
export interface IChunk {
    rowsStart: number;
    rowsEnd: number;
    bytesStart: number;
    bytesEnd: number;
}

// The `NativeEventEmitter` class provides glue code to abstract the `poll`
// interface provided by the Neon class. It may be constructed and used
// as a normal `EventEmitter`, including use by multiple subscribers.
class NativeEventEmitter extends EventEmitter {
    public static EVENTS = {
    GotItem: "GotItem",
    Progress: "Progress",
    Stopped: "Stopped",
    Finished: "Finished",
    Error: "Error",
 };
    shutdownRequested: boolean;
    isShutdown: boolean;
    shutdownDoneCallback: () => void;
    constructor(
        file: string,
        append: boolean,
        tag: string,
        out_path: string,
        timestamps: boolean,
        chunkSize: number,
    ) {
        super();

        // Create an instance of the Neon class
        const channel = new RustChannel(file, tag, out_path, append, timestamps, chunkSize);

        // Neon does not provide `Promise` return values from asynchronous
        // tasks, but it does use node style callbacks that may be trivially
        // promisified.
        // Neon uses a reference to `this` to unwrap the Rust struct. The `poll`
        // method is bound to `channel` to ensure access.
        const poll = promisify(channel.poll.bind(channel));

        // Marks the emitter as shutdown to stop iteration of the `poll` loop
        this.shutdownRequested = false;
        this.isShutdown = false;
        this.shutdownDoneCallback = () => {};

        // The `loop` method is called continuously to receive data from the Rust
        // work thread.
        const loop = () => {
            // Stop the receiving loop and shutdown the work thead. However, since
            // the `poll` method uses a blocking `recv`, this code will not execute
            // until either the next event is sent on the channel or a receive
            // timeout has occurred.
            if (this.shutdownRequested) {
                log("shutdown was requested");
                this.shutdownRequested = false;
                channel.shutdown();
            }
            if (this.isShutdown) {
                log("shutting down loop");
                this.shutdownDoneCallback();
                return;
            }

            // Poll for data
            return (
                poll()
                    .then((e: { [x: string]: any; event: any }) => {
                        // Timeout on poll, no data to emit
                        if (!e) {
                            return undefined;
                        }

                        // console.log("e was: %s", JSON.stringify(e));
                        const { event, ...data } = e;

                        // Emit the event
                        this.emit(event, data);

                        return undefined;
                    })

                    // Emit errors
                    .catch((err: any) => {
                        log("error on promise poll: " + err);
                        // this.shutdown();
                        this.emit("error", err);
                    })

                    // Schedule the next iteration of the loop. This is performed with
                    // a `setImmediate` to extending the promise chain indefinitely
                    // and causing a memory leak.
                    .then(() => {
                        setImmediate(loop);
                    })
            );
        };

        // Start the polling loop
        log("start the loop");
        loop();
    }

    // Mark the channel for shutdown
    requestShutdown() {
        this.shutdownRequested = true;
        return this;
    }
    shutdownAcknowledged(callback: () => void) {
        this.shutdownDoneCallback = callback;
        this.isShutdown = true;
        return this;
    }
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
        const emitter = new NativeEventEmitter(
            fileToIndex,
            false,
            tag,
            outPath,
            false,
            chunkSize,
        );
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
