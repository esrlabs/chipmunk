import { getNativeModule } from './native';
import { log } from './logging';
import {
  AsyncResult,
  ITicks,
  INeonTransferChunk,
  INeonNotification,
  ITimestampFormatResult,
  IDiscoverItem,
  IChunk,
  IFormatCheckResult,
  ITimestampByFormatResult,
} from './progress';
import { NativeEventEmitter, RustIndexerChannel, RustTimestampChannel, RustExportFileChannel, RustFormatVerificationChannel, RustTimestampExtractChannel } from './emitter';
import { TimeUnit } from './units';
import { CancelablePromise } from './promise';
import { IFileSaveParams } from '../../../common/interfaces/index';

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

export type TFileAsyncEvents = 'progress' | 'notification';
export type TFileAsyncEventProgress = (event: ITicks) => void;
export type TFileAsyncEventObject = TFileAsyncEventProgress;

export function exportLineBased(
  sourceFile: string,
  targetFile: string,
  wasSessionFile: boolean,
  params: IFileSaveParams
): CancelablePromise<void, void, TFileAsyncEvents, TFileAsyncEventObject> {
  return new CancelablePromise<
    void,
    void,
    TFileAsyncEvents,
    TFileAsyncEventObject
  >((resolve, reject, cancel, refCancelCB, self) => {
    try {
      log(`using file-save-parmams: ${params}`);
      // Add cancel callback
      refCancelCB(() => {
        // Cancelation is started, but not canceled
        log(`save file command "break" operation`);
        emitter.requestShutdown();
      });
      // Create channel
      const channel = new RustExportFileChannel(sourceFile, 'lines', targetFile, params, wasSessionFile);
      // Create emitter
      const emitter: NativeEventEmitter = new NativeEventEmitter(channel);
      let chunks: number = 0;
      // Add listenters
      emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
        self.emit('progress', ticks);
      });
      emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
        log(`we got a stopped event while exporting line-based file with source ${sourceFile}`);
        emitter.shutdownAcknowledged(() => {
          log('epxort file: shutdown completed after we got stopped');
          // Operation is canceled.
          cancel();
        });
      });
      emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
        self.emit('notification', notification);
      });
      emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
        log('we got a finished event after ' + chunks + ' chunks');
        emitter.shutdownAcknowledged(() => {
          log('export file: shutdown completed after finish event');
          // Operation is done.
          resolve();
        });
      });
      // Handle finale of promise
      self.finally(() => {
        log('exporting file is finished');
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

export type TFormatVerificationAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TFormatVerificationAsyncEventChunk = (event: IFormatCheckResult) => void;
export type TFormatVerificationAsyncEventProgress = (event: ITicks) => void;
export type TFormatVerificationAsyncEventNotification = (event: INeonNotification) => void;
export type TFormatVerificationAsyncEventObject =
  | TFormatVerificationAsyncEventChunk
  | TFormatVerificationAsyncEventProgress
  | TFormatVerificationAsyncEventNotification;

/**
  * Check a format string if it is generally valid
  * @param formatString 	the format string to check
  *
  * this function will deliever a positive result with a regex that was produced for the input
  * in case the input was invalid, we deliever a negative result with the reason
  */
export function checkFormat(
  formatString: string,
  missYear: boolean = false,
): CancelablePromise<void, void, TFormatVerificationAsyncEvents, TFormatVerificationAsyncEventObject> {
  return new CancelablePromise<
    void,
    void,
    TFormatVerificationAsyncEvents,
    TFormatVerificationAsyncEventObject
  >((resolve, reject, cancel, refCancelCB, self) => {
    log(`checkFormat called...`);
    try {
      // Add cancel callback
      refCancelCB(() => {
        // Cancelation is started, but not canceled
        log(`Get command "cancel" operation. Start cancellation`);
        emitter.requestShutdown();
      });
      const channel = new RustFormatVerificationChannel(formatString, missYear);
      const emitter = new NativeEventEmitter(channel);
      let totalTicks = 1;
      emitter.on(NativeEventEmitter.EVENTS.GotItem, (chunk: IFormatCheckResult) => {
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
          total: totalTicks
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

export type TTimestampExtractAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TTimestampExtractAsyncEventChunk = (event: ITimestampByFormatResult) => void;
export type TTimestampExtractAsyncEventProgress = (event: ITicks) => void;
export type TTimestampExtractAsyncEventNotification = (event: INeonNotification) => void;
export type TTimestampExtractAsyncEventObject =
  | TTimestampExtractAsyncEventChunk
  | TTimestampExtractAsyncEventProgress
  | TTimestampExtractAsyncEventNotification;

/**
  * Extracts timestamp from input-string by datetime format
  * @param inputString 	the input string to check
  * @param formatString 	the format string to use
  *
  * this function will deliever a positive result with a timestamp that was produced for the input
  * in case the format was invalid, we deliever a negative result with the reason
  */
export function exctractTimestamp(
  inputString: string,
  formatString: string
): CancelablePromise<void, void, TTimestampExtractAsyncEvents, TTimestampExtractAsyncEventObject> {
  return new CancelablePromise<
    void,
    void,
    TTimestampExtractAsyncEvents,
    TTimestampExtractAsyncEventObject
  >((resolve, reject, cancel, refCancelCB, self) => {
    log(`exctractTimestamp called...`);
    try {
      // Add cancel callback
      refCancelCB(() => {
        // Cancelation is started, but not canceled
        log(`Get command "cancel" operation. Start cancellation`);
        emitter.requestShutdown();
      });
      const channel = new RustTimestampExtractChannel(inputString, formatString);
      const emitter = new NativeEventEmitter(channel);
      let totalTicks = 1;
      emitter.on(NativeEventEmitter.EVENTS.GotItem, (chunk: ITimestampByFormatResult) => {
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
          total: totalTicks
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


export type TDiscoverTimespanAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TDiscoverTimespanAsyncEventChunk = (event: ITimestampFormatResult) => void;
export type TDiscoverTimespanAsyncEventProgress = (event: ITicks) => void;
export type TDiscoverTimespanAsyncEventNotification = (event: INeonNotification) => void;
export type TDiscoverTimespanAsyncEventObject =
  | TDiscoverTimespanAsyncEventChunk
  | TDiscoverTimespanAsyncEventProgress
  | TDiscoverTimespanAsyncEventNotification;

/**
  * Try to parse timestamps in a file and discover the timerange
  * @param itemsToDiscover 	array of IDiscoverItems
  * 	-	the path to the file is mandatory
  *   - optional you can also provide a format-string. If a format string is provided, we
  *     try to match this. If no format string is provided, we try to find a matching one.
  *   - optional each item can contain a fallback year. This will be used if the year could
  *     not be detected only!
  *
  * @result will deliver events that indicate the result for each file supplied in the input
  */
export function discoverTimespanAsync(
  itemsToDiscover: Array<IDiscoverItem>
): CancelablePromise<void, void, TDiscoverTimespanAsyncEvents, TDiscoverTimespanAsyncEventObject> {
  return new CancelablePromise<
    void,
    void,
    TDiscoverTimespanAsyncEvents,
    TDiscoverTimespanAsyncEventObject
  >((resolve, reject, cancel, refCancelCB, self) => {
    try {
      // Add cancel callback
      refCancelCB(() => {
        // Cancelation is started, but not canceled
        log(`Get command "break" operation. Starting breaking.`);
        emitter.requestShutdown();
      });
      const channel = new RustTimestampChannel(itemsToDiscover);
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
          total: totalTicks
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
  return new CancelablePromise<
    void,
    void,
    TIndexAsyncEvents,
    TIndexAsyncEventObject
  >((resolve, reject, cancel, refCancelCB, self) => {
    try {
      // Get defaults options
      const opt = getDefaultProcessorOptions(options);
      // Add cancel callback
      refCancelCB(() => {
        // Cancelation is started, but not canceled
        log(`Get command "break" operation. Starting breaking.`);
        emitter.requestShutdown();
      });
      log(`call rust indexer with opt: ${JSON.stringify(opt)}`)
      const channel = new RustIndexerChannel(
        fileToIndex,
        tag,
        outPath,
        opt.append,
        opt.timestamps,
        opt.chunkSize
      );
      const emitter = new NativeEventEmitter(channel);
      let totalTicks = 1;
      emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
        self.emit('chunk', {
          bytesStart: c.b[0],
          bytesEnd: c.b[1],
          rowsStart: c.r[0],
          rowsEnd: c.r[1]
        });
      });
      emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
        totalTicks = ticks.total;
        self.emit('progress', ticks);
      });
      emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
        log('indexAsync: we got a stopped');
        emitter.shutdownAcknowledged(() => {
          log('indexAsync: shutdown completed');
          cancel();
        });
      });
      emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
        log('indexAsync: we got a notification: ' + JSON.stringify(notification));
        self.emit('notification', notification);
      });
      emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
        log('indexAsync: we got a finished event');
        self.emit('progress', {
          ellapsed: totalTicks,
          total: totalTicks
        });
        emitter.shutdownAcknowledged(() => {
          log('indexAsync: shutdown completed');
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

function getDefaultProcessorOptions(options: IIndexOptions | undefined): IIndexOptionsChecked {
  if (typeof options !== 'object' || options === null) {
    options = {};
  }
  options.append = typeof options.append === 'boolean' ? options.append : false;
  options.timestamps = typeof options.timestamps === 'boolean' ? options.timestamps : false;
  options.chunkSize = typeof options.chunkSize === 'number' ? options.chunkSize : 5000;
  return options as IIndexOptionsChecked;
}
