const {
    RustIndexerEventEmitter: RustIndexerChannel,
    RustDltIndexerEventEmitter: RustDltIndexerChannel,
    RustDltStatsEventEmitter: RustDltStatsChannel,
    RustTimestampFormatDetectionEmitter: RustTimestampChannel,
    RustConcatenatorEmitter: RustConcatenatorChannel,
    RustMergerEmitter: RustMergerChannel,
} = require("../native/index.node");
const { EventEmitter } = require("events");
export {
    EventEmitter,
    RustIndexerChannel,
    RustDltIndexerChannel,
    RustDltStatsChannel,
    RustTimestampChannel,
    RustConcatenatorChannel,
    RustMergerChannel,
};
const { promisify } = require("util");
import { log } from "./logging";
function _onUncaughtException(error: Error) {
    log(`[BAD] UncaughtException: ${error.message}`);
}
function _onUnhandledRejection(reason: Error | any, promise: Promise<any>) {
    if (reason instanceof Error) {
        log(`[BAD] UnhandledRejection: ${reason.message}`);
    } else {
        log(`[BAD] UnhandledRejection happened. No reason as error was provided.`);
    }
}
process.on("uncaughtException", _onUncaughtException);
process.on("unhandledRejection", _onUnhandledRejection);
export enum ChannelType {
    IndexingChannel,
    DltIndexingChannel,
}
export interface IChannel {
    poll: () => void;
    shutdown: () => void;
}
// provides glue code to abstract the neon polling
// may be used as a normal `EventEmitter`, including use by multiple subscribers.
export class NativeEventEmitter extends EventEmitter {
    public static EVENTS = {
        GotItem: "GotItem",
        Progress: "Progress",
        Stopped: "Stopped",
        Finished: "Finished",
        Notification: "Notification",
        Error: "error",
    };
    shutdownRequested: boolean;
    isShutdown: boolean;
    shutdownDoneCallback: () => void;
    constructor(channel: IChannel) {
        super();

        const poll = promisify(channel.poll.bind(channel));

        // Marks the emitter as shutdown to stop iteration of the `poll` loop
        this.shutdownRequested = false;
        this.isShutdown = false;
        this.shutdownDoneCallback = () => {};

        const loop = () => {
            if (this.shutdownRequested) {
                log("shutdown was requested");
                this.shutdownRequested = false;
                channel.shutdown();
                log("shutdown request is accepted");
            }
            if (this.isShutdown) {
                log("shutting down loop");
                this.shutdownDoneCallback();
                return;
            }

            // Poll for data
            return poll()
                .then((e: { [x: string]: any; event: any }) => {
                    // Timeout on poll, no data to emit
                    if (!e) {
                        return;
                    }
                    const { event, ...data } = e;
                    this.emit(event, data);
                })
                .catch((err: any) => {
                    log(">>> error on promise poll: " + err);
                    this.emit("error", err);
                })
                .then(() => {
                    setImmediate(loop);
                });
        };
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
        log("shutdownAcknowledged");
        return this;
    }
}
