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
import { CancelablePromise } from './promise';

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

export interface IIndexOptions {
    chunkSize?: number;
    append?: boolean;
    timestamps?: boolean;
}
export interface IIndexOptionsChecked {
    chunkSize: number;
    append: boolean;
    timestamps: boolean;
}

export type TDiscoverTimespanAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TDiscoverTimespanAsyncEventChunk = (event: ITimestampFormatResult) => void;
export type TDiscoverTimespanAsyncEventProgress = (event: ITicks) => void;
export type TDiscoverTimespanAsyncEventNotification = (event: INeonNotification) => void;
export type TDiscoverTimespanAsyncEventObject = TDiscoverTimespanAsyncEventChunk | TDiscoverTimespanAsyncEventProgress | TDiscoverTimespanAsyncEventNotification;

export function discoverTimespanAsync(
    filesToDiscover: Array<IDiscoverItem>,
    options?: IIndexOptions,
): CancelablePromise<void, void, TDiscoverTimespanAsyncEvents, TDiscoverTimespanAsyncEventObject> {
    return new CancelablePromise<void, void, TDiscoverTimespanAsyncEvents, TDiscoverTimespanAsyncEventObject>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            // Get defaults options
            const opt = getDefaultProcessorOptions(options);
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                log(`Get command "break" operation. Starting breaking.`);
                emitter.requestShutdown();
            });
            const channel = new RustTimestampChannel(filesToDiscover);
            const emitter = new NativeEventEmitter(channel);
            let totalTicks = 1;
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (chunk: ITimestampFormatResult) => {
                self.emit('chunk', chunk);
            });
            emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
                totalTicks = ticks.total;
                self.emit('progress', ticks);
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                emitter.shutdownAcknowledged(() => {
                    cancel();
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
                self.emit('notification', notification);
            });
            emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
                self.emit('progress', {
                    ellapsed: totalTicks,
                    total: totalTicks,
                });
                emitter.shutdownAcknowledged(() => {
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

export type TIndexAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TIndexAsyncEventChunk = (event: IChunk) => void;
export type TIndexAsyncEventProgress = (event: ITicks) => void;
export type TIndexAsyncEventNotification = (event: INeonNotification) => void;
export type TIndexAsyncEventObject = TIndexAsyncEventChunk | TIndexAsyncEventProgress | TIndexAsyncEventNotification;

export function indexAsync(
    fileToIndex: string,
    outPath: string,
    tag: string,
    options?: IIndexOptions
): CancelablePromise<void, void, TIndexAsyncEvents, TIndexAsyncEventObject> {
    return new CancelablePromise<void, void, TIndexAsyncEvents, TIndexAsyncEventObject>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            // Get defaults options
            const opt = getDefaultProcessorOptions(options);
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                log(`Get command "break" operation. Starting breaking.`);
                emitter.requestShutdown();
            });
            const channel = new RustIndexerChannel(
                fileToIndex,
                tag,
                outPath,
                opt.append,
                opt.timestamps,
                opt.chunkSize,
            );
            const emitter = new NativeEventEmitter(channel);
            let totalTicks = 1;
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
                self.emit('chunk', {
                    bytesStart: c.b[0],
                    bytesEnd: c.b[1],
                    rowsStart: c.r[0],
                    rowsEnd: c.r[1],
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
                totalTicks = ticks.total;
                self.emit('progress', ticks);
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                log("indexAsync: we got a stopped");
                emitter.shutdownAcknowledged(() => {
                    log("indexAsync: shutdown completed");
                    cancel();
                });
            });
            emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
                log("indexAsync: we got a notification: " + JSON.stringify(notification));
                self.emit('notification', notification);
            });
            emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
                log("indexAsync: we got a finished event");
                self.emit('progress', {
                    ellapsed: totalTicks,
                    total: totalTicks,
                });
                emitter.shutdownAcknowledged(() => {
                    log("indexAsync: shutdown completed");
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

export function detectTimestampInString(input: string): string {
    return addon.detectTimestampInString(input);
}

export function detectTimestampFormatInFile(input: string): string {
    return addon.detectTimestampFormatInFile(input);
}

function getDefaultProcessorOptions(options: IIndexOptions | undefined): IIndexOptionsChecked {
    if (typeof options !== 'object' || options === null) {
        options = {};
    }
    options.append = typeof options.append === 'boolean' ? options.append : false;
    options.timestamps = typeof options.timestamps === 'boolean' ? options.timestamps : false;
    options.chunkSize = typeof options.chunkSize === 'number' ? options.chunkSize : 5000;
    return options as IIndexOptionsChecked;
}
