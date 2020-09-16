import { log } from '../util/logging';
import { ITicks, INeonNotification } from '../util/progress';
import { NativeComputationManager } from '../native_computation_manager';
import {
	RustExportFileChannel,
} from '../native';
import { CancelablePromise } from '../util/promise';
import { IFileSaveParams } from '../../../../common/interfaces/index';
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
			const emitter: NativeComputationManager<void> = new NativeComputationManager(channel);
			let chunks: number = 0;
			// Add listenters
			emitter
				.onProgress((ticks: ITicks) => {
					self.emit('progress', ticks);
				})
				.onStopped(() => {
					log(`we got a stopped event while exporting line-based file with source ${sourceFile}`);
					cancel();
				});
			emitter.onNotification((notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			emitter.onFinished(() => {
				log('we got a finished event after ' + chunks + ' chunks');
				resolve();
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
