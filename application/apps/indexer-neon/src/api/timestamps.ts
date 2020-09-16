import { log } from '../util/logging';
import { NativeComputationManager } from '../native_computation_manager';
import { RustTimestampChannel, RustTimestampExtractChannel, RustFormatVerificationChannel } from '../native';
import { ICheckFormatFlags, DateTimeReplacements } from '../../../../common/interfaces/interface.detect';
import {
	ITicks,
	INeonNotification,
	ITimestampFormatResult,
	IDiscoverItem,
	ITimestampByFormatResult,
	IFormatCheckResult
} from '../util/progress';
import { CancelablePromise } from '../util/promise';

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
  * @param {DateTimeReplacements} replacements definitions for DD, MM, YYYY and offset if something is missed
  *
  * this function will deliever a positive result with a timestamp that was produced for the input
  * in case the format was invalid, we deliever a negative result with the reason
  */
export function exctractTimestamp(
	inputString: string,
	formatString: string,
	replacements: DateTimeReplacements
): CancelablePromise<void, void, TTimestampExtractAsyncEvents, TTimestampExtractAsyncEventObject> {
	return new CancelablePromise<
		void,
		void,
		TTimestampExtractAsyncEvents,
		TTimestampExtractAsyncEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		log(`exctractTimestamp called...`);
		try {
			const channel = new RustTimestampExtractChannel(inputString, formatString, replacements);
			const computation = new NativeComputationManager<ITimestampByFormatResult>(channel);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "cancel" operation. Start cancellation`);
				computation.requestShutdown();
			});
			let totalTicks = 1;
			computation.onItem((chunk: ITimestampByFormatResult) => {
				self.emit('chunk', chunk);
			});
			computation.onProgress((ticks: ITicks) => {
				totalTicks = ticks.total;
				self.emit('progress', ticks);
			});
			computation.onStopped(() => {
				cancel();
			});
			computation.onNotification((notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			computation.onFinished(() => {
				self.emit('progress', {
					ellapsed: totalTicks,
					total: totalTicks
				});
				resolve();
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
			const timestampChannel = new RustTimestampChannel();
			const computation = new NativeComputationManager<ITimestampFormatResult>(timestampChannel);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Starting breaking.`);
				computation.requestShutdown();
			});
			let totalTicks = 1;
			log('start listening to rust side');
			computation.onItem((chunk: ITimestampFormatResult) => {
				self.emit('chunk', chunk);
			});
			computation.onProgress((ticks: ITicks) => {
				log('onProgress: ' + JSON.stringify(ticks));
				totalTicks = ticks.total;
				self.emit('progress', ticks);
			});
			computation.onStopped(() => {
				cancel();
			});
			computation.onNotification((notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			computation.onFinished(() => {
				self.emit('progress', {
					ellapsed: totalTicks,
					total: totalTicks
				});
				resolve();
			});
			// finally trigger the async function
			timestampChannel.start(itemsToDiscover);
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
  * @param {string} formatString 	the format string to check
  * @param {ICheckFormatFlags} flags define possobility to skip checking of data parts (DD, MM, YYYY)
  *
  * this function will deliever a positive result with a regex that was produced for the input
  * in case the input was invalid, we deliever a negative result with the reason
  */
export function checkFormat(
	formatString: string,
	flags: ICheckFormatFlags = { miss_day: false, miss_month: false, miss_year: false }
): CancelablePromise<void, void, TFormatVerificationAsyncEvents, TFormatVerificationAsyncEventObject> {
	return new CancelablePromise<
		void,
		void,
		TFormatVerificationAsyncEvents,
		TFormatVerificationAsyncEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		log(`checkFormat called...`);
		try {
			const channel = new RustFormatVerificationChannel(formatString, flags);
			const computation = new NativeComputationManager<IFormatCheckResult>(channel);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "cancel" operation. Start cancellation`);
				computation.requestShutdown();
			});
			let totalTicks = 1;
			computation.onItem((chunk: IFormatCheckResult) => {
				self.emit('chunk', chunk);
			});
			computation.onProgress((ticks: ITicks) => {
				totalTicks = ticks.total;
				self.emit('progress', ticks);
			});
			computation.onStopped(() => {
				cancel();
			});
			computation.onNotification((notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			computation.onFinished(() => {
				self.emit('progress', {
					ellapsed: totalTicks,
					total: totalTicks
				});
				resolve();
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
