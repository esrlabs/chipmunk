const addon = require("../native");
import { log } from "./logging";
import {
    ITicks,
    INeonNotification,
    IMergerItemOptions,
    INeonTransferChunk,
    IChunk,
} from "./progress";
import { NativeEventEmitter, RustConcatenatorChannel, RustMergerChannel } from "./emitter";
import { CancelablePromise } from './promise';

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

export interface IMergeFilesOptions {
    append?: boolean,
    chunk_size?: number,
}
export interface IMergeFilesOptionsChecked {
    append: boolean,
    chunk_size: number,
}

export type TMergeFilesEvents = 'result' | 'progress' | 'notification';
export type TMergeFilesEventResult = (event: IChunk) => void;
export type TMergeFilesEventProgress = (event: ITicks) => void;
export type TMergeFilesEventNotification = (event: INeonNotification) => void;
export type TMergeFilesEventObject = TMergeFilesEventResult | TMergeFilesEventProgress | TMergeFilesEventNotification;

export function mergeFilesAsync(
    config: Array<IMergerItemOptions>,
    outFile: string,
    options?: IMergeFilesOptions,
): CancelablePromise<void, void, TMergeFilesEvents, TMergeFilesEventObject> {
    return new CancelablePromise<void, void, TMergeFilesEvents, TMergeFilesEventObject>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            // Get defaults options
            const opt = getDefaultMergeOptions(options);
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                log(`Get command "break" operation. Starting breaking.`);
                emitter.requestShutdown();
            });
            log(`mergeFilesAsync called with config: ${JSON.stringify(config)}`);
            const channel = new RustMergerChannel(
                config,
                outFile,
                opt.append,
                opt.chunk_size,
            );
            const emitter = new NativeEventEmitter(channel);
            let totalTicks = 1;
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
                self.emit('result', {
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
            emitter.on(NativeEventEmitter.EVENTS.Error, () => {
                log(`Event "Error" is triggered`);
                emitter.requestShutdown();
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                log(`Event "Stopped" is triggered`);
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

export type TConcatFilesEvents = 'result' | 'progress' | 'notification';
export type TConcatFilesEventResult = (event: IChunk) => void;
export type TConcatFilesEventProgress = (event: ITicks) => void;
export type TConcatFilesEventNotification = (event: INeonNotification) => void;
export type TConcatFilesEventObject = TConcatFilesEventResult | TConcatFilesEventProgress | TConcatFilesEventNotification;

export function concatFilesAsync(
    config: Array<ConcatenatorInput>,
    outFile: string,
    options?: IMergeFilesOptions,
): CancelablePromise<void, void, TConcatFilesEvents, TConcatFilesEventObject> {
    return new CancelablePromise<void, void, TConcatFilesEvents, TConcatFilesEventObject>((resolve, reject, cancel, refCancelCB, self) => {
        try {
            // Get defaults options
            const opt = getDefaultMergeOptions(options);
            // Add cancel callback
            refCancelCB(() => {
                // Cancelation is started, but not canceled
                log(`Get command "break" operation. Starting breaking.`);
                emitter.requestShutdown();
            });
            const channel = new RustConcatenatorChannel(config, outFile, opt.append, opt.chunk_size);
            const emitter = new NativeEventEmitter(channel);
            let totalTicks = 1;
            emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
                self.emit('result', {
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
            emitter.on(NativeEventEmitter.EVENTS.Error, () => {
                log(`Event "Error" is triggered`);
                emitter.requestShutdown();
            });
            emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
                log(`Event "Stopped" is triggered`);
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

function getDefaultMergeOptions(options: IMergeFilesOptions | undefined): IMergeFilesOptionsChecked {
    if (typeof options !== 'object' || options === null) {
        options = {};
    }
    options.append = typeof options.append === 'boolean' ? options.append : true;
    options.chunk_size = typeof options.chunk_size === 'number' ? options.chunk_size : 5000;
    return options as IMergeFilesOptionsChecked;
}
