import * as Events from '../util/events';
import * as Logs from '../util/logging';

import { RustSessionChannel, RustAppendOperationChannel, RustAppendOperationChannelConstructor } from '../native/index';
import { CancelablePromise } from '../util/promise';
import { SessionComputation } from './session.computation';
import { StreamAppendComputation } from './session.stream.append.computation';

abstract class Connector<T> {
	
	public abstract disconnect(): Promise<void>; 			// Equal to destroy
	public abstract setOptions(options: T): Promise<void>;	// To have a way update options in on fly
	public abstract getSubjects(): {						// Major events
		disconnected: Events.Subject<void>,
		connected: Events.Subject<void>,
	};

}

export class SessionStream {
	
	private readonly _computation: SessionComputation;
	private readonly _channel: RustSessionChannel;
	private readonly _uuid: string;
	private readonly _logger: Logs.Logger;
	
	constructor(computation: SessionComputation, channel: RustSessionChannel, uuid: string) {
		this._logger = Logs.getLogger(`SessionStream: ${uuid}`);
		this._computation = computation;
		this._channel = channel;
		this._uuid = uuid;
	}

	public destroy(): Promise<void> {
		return new Promise((resolve, reject) => {
			this._computation.destroy().then(resolve).catch((err: Error) => {
				this._logger.error(`Fail to destroy computation due error: ${err.message}`);
				reject(err);
			});
		});
	}

	public grab(line_index: number, line_count: number): string {
		return this._channel.grabStream(line_index, line_count);
	}

	// Detecting of file type happens on rust level.
	// Meta data comes to nodejs via "grabbing"
	public append(filename: string): CancelablePromise<void, void, void, void> {
		return new CancelablePromise<void, void, void, void>((resolve, reject, cancel, refCancelCB, self) => {
			this._logger.debug('Append operation is started');
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				this._logger.debug(`Get command "break" operation. Starting breaking.`);
				// We don't need to listen destroy event on cancel
				destroySubscription.unsubscribe();
				// Destroy computation manually
				computation.destroy().catch((err: Error) => {
					this._logger.warn(`Fail to destroy correctly computation instance for "append" operation due error: ${err.message}`);
				});
			});
			const channel: RustAppendOperationChannel = new RustAppendOperationChannelConstructor();
			const computation: StreamAppendComputation = new StreamAppendComputation(channel, this._uuid);
			let error: Error | undefined;
			computation.getEvents().error.subscribe((err: Error) => {
				this._logger.warn(`Error on operation append: ${err.message}`);
				error = err;
			});
			const destroySubscription = computation.getEvents().destroyed.subscribe(() => {
				if (error) {
					this._logger.warn('Append operation is failed');
					reject(error);
				} else {
					this._logger.debug('Append operation is successful');
					resolve();
				}
			});
			// Handle finale of promise
			self.finally(() => {
				this._logger.debug('Append operation promise is closed as well');
			});
			// Call operation
			channel.append(this._uuid, filename);
		});
	}

	public concat(options: any): CancelablePromise {
		return new CancelablePromise(() => {
			// concatination
		});
	}

	public merge(): CancelablePromise {
		return new CancelablePromise(() => {
			// merging
		});
	}

	public export(start: number, end: number, options: any): CancelablePromise {
		return new CancelablePromise(() => {
			// merging
		});
	}

	public connect(): {
		//dlt: (options: IDLTOptions) => Connector<IDLTOptions>,
		//adb: (options: IADBOptions) => Connector<IADBOptions>,
	} {
		return { };
	}

	public len(): number {
		const len = this._channel.getStreamLen();
		if (typeof len !== 'number' || isNaN(len) || !isFinite(len)) {
			this._logger.warn(`Has been gotten not valid rows number: ${len} (typeof: ${typeof len}).`);
			return 0;
		} else {
			return len;
		}
	}

}