import { log } from '../util/logging';
import { ITicks, INeonTransferChunk, INeonNotification, IChunk } from '../util/progress';
import {
	RustDltIndexerChannel,
	RustDltStatsChannel,
	RustExportFileChannel,
	RustDltSocketChannel,
	RustDltPcapChannel
} from '../native';
import {
	NativeComputationManager,
} from '../native_computation_manager';
import { CancelablePromise } from '../util/promise';
import {
	IDLTFilters,
	IDLTOptions,
	IIndexDltParams,
	DltFilterConf,
	DltLogLevel,
	LevelDistribution,
	StatisticInfo,
	IFibexConfig
} from '../../../../common/interfaces/interface.dlt';
import { IFileSaveParams } from '../../../../common/interfaces';

export {
	IDLTFilters,
	IDLTOptions,
	IIndexDltParams,
	DltFilterConf,
	DltLogLevel,
	LevelDistribution,
	StatisticInfo,
	IFibexConfig
};

export interface IDltSocketParams {
	filterConfig: DltFilterConf;
	fibex: IFibexConfig;
	tag: string;
	out: string;
	stdout: boolean;
	statusUpdates: boolean;
}

export interface ISocketConfig {
	multicast_addr?: IMulticastInfo;
	bind_addr: string;
	port: string;
}
/// Multicast config information.
/// `multiaddr` address must be a valid multicast address
/// `interface` is the address of the local interface with which the
/// system should join the
/// multicast group. If it's equal to `INADDR_ANY` then an appropriate
/// interface is chosen by the system.
export interface IMulticastInfo {
	multiaddr: string;
	interface?: string;
}

export interface IIndexDltOptions {}
export interface IIndexDltOptionsChecked {}

export type TDltStatsEvents = 'config' | 'progress' | 'notification';
export type TDltStatsEventConfig = (event: StatisticInfo) => void;
export type TDltStatsEventProgress = (event: ITicks) => void;
export type TDltStatsEventNotification = (event: INeonNotification) => void;
export type TDltStatsEventObject = TDltStatsEventConfig | TDltStatsEventProgress | TDltStatsEventNotification;

export function dltStatsAsync(
	dltFile: string,
	options?: IIndexDltOptions
): CancelablePromise<void, void, TDltStatsEvents, TDltStatsEventObject> {
	return new CancelablePromise<
		void,
		void,
		TDltStatsEvents,
		TDltStatsEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		try {
			// Get defaults options
			const opt = getDefaultIndexDltProcessingOptions(options);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Starting breaking.`);
				emitter.requestShutdown();
			});
			const channel = new RustDltStatsChannel(dltFile);
			const emitter = new NativeComputationManager<StatisticInfo>(channel);
			let total: number = 1;
			emitter.onItem((chunk: StatisticInfo) => {
				self.emit('config', chunk);
			});
			emitter.onProgress((ticks: ITicks) => {
				total = ticks.total;
				self.emit('progress', ticks);
			});
			emitter.onStopped(() => {
				cancel();
			});
			emitter.onNotification((notification: INeonNotification) => {
				log('dltStats: we got a notification: ' + JSON.stringify(notification));
				self.emit('notification', notification);
			});
			emitter.onFinished(() => {
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

export type TDltFileAsyncEvents = 'progress' | 'notification';
export type TDltFileAsyncEventProgress = (event: ITicks) => void;
export type TDltFileAsyncEventObject = TDltFileAsyncEventProgress;

export function exportDltFile(
	source: string,
	sourceType: 'session' | 'file',
	targetFile: string,
	params: IFileSaveParams
): CancelablePromise<void, void, TDltFileAsyncEvents, TDltFileAsyncEventObject> {
	return new CancelablePromise<
		void,
		void,
		TDltFileAsyncEvents,
		TDltFileAsyncEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		try {
			log(`exportDltFile using file-save-parmams: ${params}`);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`export dlt file command "break" operation`);
				emitter.requestShutdown();
			});
			// Create channel
			const channel = new RustExportFileChannel(source, sourceType, targetFile, params, false);
			// Create emitter
			const emitter: NativeComputationManager<ITicks> = new NativeComputationManager(channel);
			let chunks: number = 0;
			// Add listenters
			emitter.onItem((ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.onStopped(() => {
				log(`we got a stopped event while saving dlt file (${sourceType}) with source ${source}`);
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
				log('processing dlt export is finished');
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

export type TIndexDltAsyncEvents = 'chunk' | 'progress' | 'notification';
export type TIndexDltAsyncEventChunk = (event: IChunk) => void;
export type TIndexDltAsyncEventProgress = (event: ITicks) => void;
export type TIndexDltAsyncEventNotification = (event: INeonNotification) => void;
export type TIndexDltAsyncEventObject =
	| TIndexDltAsyncEventChunk
	| TIndexDltAsyncEventProgress
	| TIndexDltAsyncEventNotification;

export function indexDltAsync(
	params: IIndexDltParams,
	options?: IIndexDltOptions
): CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventObject> {
	return new CancelablePromise<
		void,
		void,
		TIndexDltAsyncEvents,
		TIndexDltAsyncEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		try {
			log(`using fibex: ${params.fibex}`);
			// Get defaults options
			const opt = getDefaultIndexDltProcessingOptions(options);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Starting breaking.`);
				emitter.requestShutdown();
			});
			// Create channel
			const channel = new RustDltIndexerChannel(
				params.dltFile,
				params.tag,
				params.out,
				params.append,
				params.chunk_size,
				params.filterConfig,
				params.fibex
			);
			// Create emitter
			const emitter: NativeComputationManager<INeonTransferChunk> = new NativeComputationManager(channel);
			let chunks: number = 0;
			// Add listenters
			emitter.onItem((c: INeonTransferChunk) => {
				self.emit('chunk', {
					bytesStart: c.b[0],
					bytesEnd: c.b[1],
					rowsStart: c.r[0],
					rowsEnd: c.r[1]
				});
				chunks += 1;
			});
			emitter.onProgress((ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.onStopped(() => {
				log('we got a stopped event after ' + chunks + ' chunks');
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
				log('processing dlt indexing is finished');
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

export type TDLTSocketEvents = 'chunk' | 'progress' | 'notification' | 'connect';
export type TDLTSocketEventChunk = (event: IChunk) => void;
export type TDLTSocketEventConnect = () => void;
export type TDLTSocketEventProgress = (event: ITicks) => void;
export type TDLTSocketEventNotification = (event: INeonNotification) => void;
export type TDLTSocketEventObject =
	| TDLTSocketEventChunk
	| TDLTSocketEventConnect
	| TDLTSocketEventProgress
	| TDLTSocketEventNotification;

export function indexPcapDlt(
	params: IIndexDltParams
): CancelablePromise<void, void, TIndexDltAsyncEvents, TIndexDltAsyncEventObject> {
	log('indexPcapDlt');
	return new CancelablePromise<
		void,
		void,
		TIndexDltAsyncEvents,
		TIndexDltAsyncEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		log(`indexPcapDlt: params: ${JSON.stringify(params)}`);
		try {
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Requesting shutdown.`);
				emitter.requestShutdown();
			});
			// Create channel
			const channel = new RustDltPcapChannel(
				params.dltFile,
				params.tag,
				params.out,
				params.chunk_size,
				params.filterConfig,
				params.append,
				params.fibex
			);
			log('created channel');
			// Create emitter
			const emitter: NativeComputationManager<INeonTransferChunk> = new NativeComputationManager(channel);
			log('created emitter');
			let chunks: number = 0;
			// Add listenters
			emitter.onItem((c: INeonTransferChunk) => {
				log('received pcap item: ' + JSON.stringify(c));
				self.emit('chunk', {
					bytesStart: c.b[0],
					bytesEnd: c.b[1],
					rowsStart: c.r[0],
					rowsEnd: c.r[1]
				});
				chunks += 1;
			});
			emitter.onProgress((ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.onStopped(() => {
				log('pcap: we got a stopped event after ' + chunks + ' chunks');
				cancel();
			});
			emitter.onNotification((notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			emitter.onFinished(() => {
				log('pcap: we got a finished event after ' + chunks + ' chunks');
				resolve();
			});
			// Handle finale of promise
			self.finally(() => {
				log('processing dlt pcap is finished');
			});
		} catch (err) {
			if (!(err instanceof Error)) {
				log(`pcap operation is stopped. Error isn't valid:`);
				log(err);
				err = new Error(`pcap operation is stopped. Error isn't valid.`);
			} else {
				log(`pcap: operation is stopped due error: ${err.message}`);
			}
			// Operation is rejected
			reject(err);
		}
	});
}
export function dltOverSocket(
	sessionId: String,
	params: IDltSocketParams,
	socketConfig: ISocketConfig
): CancelablePromise<void, void, TDLTSocketEvents, TDLTSocketEventObject> {
	return new CancelablePromise<
		void,
		void,
		TDLTSocketEvents,
		TDLTSocketEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		log(`dltOverSocket: params: ${JSON.stringify(params)}`);
		try {
			log(`dltOverSocket: using sock-conf: ${JSON.stringify(socketConfig)}`);
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Starting breaking.`);
				emitter.requestShutdown();
			});
			// Create channel
			const channel = new RustDltSocketChannel(
				sessionId,
				socketConfig,
				params.tag,
				params.out,
				params.filterConfig,
				params.fibex
			);
			// Create emitter
			const emitter: NativeComputationManager<INeonTransferChunk> = new NativeComputationManager(channel);
			let chunks: number = 0;
			// Add listenters
			emitter.onItem((c: INeonTransferChunk) => {
				log('received over socket: ' + JSON.stringify(c));
				if (c.b[0] === 0 && c.b[1] === 0) {
					self.emit('connect');
				} else {
					self.emit('chunk', {
						bytesStart: c.b[0],
						bytesEnd: c.b[1],
						rowsStart: c.r[0],
						rowsEnd: c.r[1]
					});
					chunks += 1;
				}
			});
			emitter.onProgress((ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.onStopped(() => {
				log('we got a stopped event after ' + chunks + ' chunks');
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
				log('processing dlt indexing is finished');
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

function getDefaultIndexDltProcessingOptions(options: IIndexDltOptions | undefined): IIndexDltOptionsChecked {
	if (typeof options !== 'object' || options === null) {
		options = {};
	}
	return options as IIndexDltOptionsChecked;
}
