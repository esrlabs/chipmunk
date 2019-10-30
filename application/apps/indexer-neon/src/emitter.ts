const {
    RustIndexerEventEmitter: RustIndexerChannel,
    RustDltIndexerEventEmitter: RustDltIndexerChannel,
    RustDltStatsEventEmitter: RustDltStatsChannel,
} = require("../native/index.node");
const { EventEmitter } = require("events");
export { EventEmitter, RustIndexerChannel, RustDltIndexerChannel, RustDltStatsChannel };
const { promisify } = require("util");
import { log } from "./logging";

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
        Error: "Error",
    };
    shutdownRequested: boolean;
    isShutdown: boolean;
    shutdownDoneCallback: () => void;
    constructor(
        channel: IChannel,
    ) {
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
                        return undefined;
                    }
                    const { event, ...data } = e;
                    this.emit(event, data);
                    return undefined;
                })
                .catch((err: any) => {
                    log("error on promise poll: " + err);
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
        return this;
    }
}
