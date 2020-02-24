import { log } from './logging';
import { ITicks, INeonTransferChunk, INeonNotification, IChunk } from './progress';
import {
	NativeEventEmitter,
	RustDltIndexerChannel,
	RustDltStatsChannel,
	RustDltSaveFileChannel,
	RustDltSocketChannel,
	RustDltPcapChannel
} from './emitter';
import { CancelablePromise } from './promise';
import {
	IDLTFilters,
	IDLTOptions,
	IIndexDltParams,
	IFileSaveParams,
	DltFilterConf,
	DltLogLevel,
	LevelDistribution,
	StatisticInfo,
	IFibexConfig
} from '../../../common/interfaces/interface.dlt';

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
			const emitter = new NativeEventEmitter(channel);
			let total: number = 1;
			emitter.on(NativeEventEmitter.EVENTS.GotItem, (chunk: StatisticInfo) => {
				self.emit('config', chunk);
			});
			emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
				total = ticks.total;
				self.emit('progress', ticks);
			});
			emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
				emitter.shutdownAcknowledged(() => {
					cancel();
				});
			});
			emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
				log('dltStats: we got a notification: ' + JSON.stringify(notification));
				self.emit('notification', notification);
			});
			emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
				emitter.shutdownAcknowledged(() => {
					self.emit('progress', { ellapsed: total, total });
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

export type TDltFileAsyncEvents = 'progress' | 'notification';
export type TDltFileAsyncEventProgress = (event: ITicks) => void;
export type TDltFileAsyncEventObject = TDltFileAsyncEventProgress;

export function saveDltFile(
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
			log(`using file-save-parmams: ${params}`);
			// Get defaults options
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`save file command "break" operation`);
				emitter.requestShutdown();
			});
			// Create channel
			const channel = new RustDltSaveFileChannel(source, sourceType, targetFile, params);
			// Create emitter
			const emitter: NativeEventEmitter = new NativeEventEmitter(channel);
			let chunks: number = 0;
			// Add listenters
			emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
				log(`we got a stopped event while saving dlt file (${sourceType}) with source ${source}`);
				emitter.shutdownAcknowledged(() => {
					log('indexDlt: shutdown completed after we got stopped');
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
					log('indexDlt: shutdown completed after finish event');
					// Operation is done.
					resolve();
				});
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
			const emitter: NativeEventEmitter = new NativeEventEmitter(channel);
			let chunks: number = 0;
			// Add listenters
			emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
				self.emit('chunk', {
					bytesStart: c.b[0],
					bytesEnd: c.b[1],
					rowsStart: c.r[0],
					rowsEnd: c.r[1]
				});
				chunks += 1;
			});
			emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
				log('we got a stopped event after ' + chunks + ' chunks');
				emitter.shutdownAcknowledged(() => {
					log('indexDlt: shutdown completed after we got stopped');
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
					log('indexDlt: shutdown completed after finish event');
					// Operation is done.
					resolve();
				});
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
			const emitter: NativeEventEmitter = new NativeEventEmitter(channel);
			log('created emitter');
			let chunks: number = 0;
			// Add listenters
			emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
				log('received pcap item: ' + JSON.stringify(c));
				self.emit('chunk', {
					bytesStart: c.b[0],
					bytesEnd: c.b[1],
					rowsStart: c.r[0],
					rowsEnd: c.r[1]
				});
				chunks += 1;
			});
			emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
				log('pcap: we got a stopped event after ' + chunks + ' chunks');
				emitter.shutdownAcknowledged(() => {
					log('pcap: shutdown completed after we got stopped');
					// Operation is canceled.
					cancel();
				});
			});
			emitter.on(NativeEventEmitter.EVENTS.Notification, (notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			emitter.on(NativeEventEmitter.EVENTS.Finished, () => {
				log('pcap: we got a finished event after ' + chunks + ' chunks');
				emitter.shutdownAcknowledged(() => {
					log('pcap: shutdown completed after finish event');
					// Operation is done.
					resolve();
				});
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
			const emitter: NativeEventEmitter = new NativeEventEmitter(channel);
			let chunks: number = 0;
			// Add listenters
			emitter.on(NativeEventEmitter.EVENTS.GotItem, (c: INeonTransferChunk) => {
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
			emitter.on(NativeEventEmitter.EVENTS.Progress, (ticks: ITicks) => {
				self.emit('progress', ticks);
			});
			emitter.on(NativeEventEmitter.EVENTS.Stopped, () => {
				log('we got a stopped event after ' + chunks + ' chunks');
				emitter.shutdownAcknowledged(() => {
					log('socketDlt: shutdown completed after we got stopped');
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
					log('socketDlt: shutdown completed after finish event');
					// Operation is done.
					resolve();
				});
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
