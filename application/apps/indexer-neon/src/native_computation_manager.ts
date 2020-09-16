import { log } from "./util/logging";
import { EventEmitter } from "events";
import { ITicks, INeonNotification } from "./util/progress";
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
    poll: (callback: (err: string, e: { [x: string]: any; event_tag: string; }) => void) => void;
    shutdown: () => void;
}
// provides glue code to abstract the neon polling
// clients can register for different events
export class NativeComputationManager<T> {
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
    eventEmitter: EventEmitter;
    constructor(channel: IChannel) {
        this.eventEmitter = new EventEmitter();
        log("init of NativeComputationManager");

        // Marks the emitter as shutdown to stop iteration of the `poll` loop
        this.shutdownRequested = false;
        this.isShutdown = false;

        const loop = () => {
            if (this.shutdownRequested) {
                log("shutdown had been requested, now accepted!");
                this.shutdownRequested = false;
                channel.shutdown();
            }
            if (this.isShutdown) {
                log("shutting down loop");
                return;
            }
            // Poll for data
            channel.poll((err: string, eventData: { [x: string]: any; event_tag: string; }) => {
                if (err) {
                    log(">>> error on promise poll: " + err);
                    this.eventEmitter.emit("error", err);
                }
                else if (eventData) {
                    const { event, ...data } = eventData;

                    // Emit the event
                    this.eventEmitter.emit(event, data);
                    if (event == NativeComputationManager.EVENTS.Finished) {
                        this.isShutdown = true;
                        log("shutdownAcknowledged");
                        return;
                    }
                }
                // Otherwise, timeout on poll, no data to emit

                // Schedule the next iteration of the loop. This is performed with
                // a `setImmediate` to yield to the event loop, to let JS code run
                // and avoid a stack overflow.
                setImmediate(loop);
            });
        };

        // Start the polling loop on next iteration of the JS event loop
        setImmediate(loop);
    }

    /**
     * onItem
     */
    public onItem(callback: (chunk: T) => void) {
        this.eventEmitter.on(NativeComputationManager.EVENTS.GotItem, callback);
    }
    /**
     * onProgress
     */
    public onProgress(callback: (ticks: ITicks) => void): NativeComputationManager<T> {
        this.eventEmitter.on(NativeComputationManager.EVENTS.Progress, callback);
        return this;
    }

    /**
     * onStopped
     */
    public onStopped(callback: () => void) {
        this.eventEmitter.on(NativeComputationManager.EVENTS.Stopped, callback);
    }

    /**
     * onNotification
     */
    public onNotification(callback: (notification: INeonNotification) => void) {
        this.eventEmitter.on(NativeComputationManager.EVENTS.Notification, callback);
    }

    /**
     * onError
     */
    public onError(callback: () => void) {
        this.eventEmitter.on(NativeComputationManager.EVENTS.Error, callback);
    }

    /**
     * onFinished
     */
    public onFinished(callback: () => void) {
        this.eventEmitter.on(NativeComputationManager.EVENTS.Finished, callback);
    }

    /**
     * requestShutdown
     *
     * Mark the channel for shutdown
     */
    public requestShutdown(): NativeComputationManager<T> {
        this.shutdownRequested = true;
        return this;
    }
}
