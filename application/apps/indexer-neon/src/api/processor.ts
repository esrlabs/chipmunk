import { log } from '../util/logging';
import { ITicks, INeonTransferChunk, INeonNotification, IChunk } from '../util/progress';
import { NativeComputationManager } from '../native_computation_manager';
import { RustIndexerChannel } from '../native';
import { CancelablePromise } from '../util/promise';
import { ICheckFormatFlags, DateTimeReplacements } from '../../../../common/interfaces/interface.detect';

export { ICheckFormatFlags, DateTimeReplacements };

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
			const opt = getDefaultProcessorOptions(options);
			log(`call rust indexer with opt: ${JSON.stringify(opt)}`);
			// Get defaults options
			const channel = new RustIndexerChannel(
				fileToIndex,
				tag,
				outPath,
				opt.append,
				opt.timestamps,
				opt.chunkSize
			);
			const computation = new NativeComputationManager<INeonTransferChunk>(channel);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Starting breaking.`);
				computation.requestShutdown();
			});
			let totalTicks = 1;
			computation.onItem((c: INeonTransferChunk) => {
				self.emit('chunk', {
					bytesStart: c.b[0],
					bytesEnd: c.b[1],
					rowsStart: c.r[0],
					rowsEnd: c.r[1]
				});
			});
			computation.onProgress((ticks: ITicks) => {
				totalTicks = ticks.total;
				self.emit('progress', ticks);
			});
			computation.onStopped(() => {
				log('indexAsync: we got a stopped');
				cancel();
			});
			computation.onNotification((notification: INeonNotification) => {
				log('indexAsync: we got a notification: ' + JSON.stringify(notification));
				self.emit('notification', notification);
			});
			computation.onFinished(() => {
				log('indexAsync: we got a finished event');
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

function getDefaultProcessorOptions(options: IIndexOptions | undefined): IIndexOptionsChecked {
	if (typeof options !== 'object' || options === null) {
		options = {};
	}
	options.append = typeof options.append === 'boolean' ? options.append : false;
	options.timestamps = typeof options.timestamps === 'boolean' ? options.timestamps : false;
	options.chunkSize = typeof options.chunkSize === 'number' ? options.chunkSize : 5000;
	return options as IIndexOptionsChecked;
}
