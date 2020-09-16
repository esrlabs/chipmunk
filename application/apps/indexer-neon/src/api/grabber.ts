import { log } from '../util/logging';
import { RustGrabberChannel } from '../native';
import { CancelablePromise } from '../util/promise';
import { NativeComputationManager } from '../native_computation_manager';
import { ITicks, INeonNotification } from '../util/progress';

export class RustGrabberClass {
	channel: any;
	computation: NativeComputationManager<void>;
	constructor(path: string) {
		this.channel = new RustGrabberChannel(path);
		this.computation = new NativeComputationManager<void>(this.channel);
	}
	public create_metadata() {
		this.channel.create_metadata_async();
	}
	public grab(line_index: number, line_count: number): string {
		return this.channel.grab(line_index, line_count);
	}
	public total_entries(): number | undefined {
        let entry_cnt = this.channel.total_entries();
        if (entry_cnt.length == 1) {
            return entry_cnt[0];
        }
        return undefined;
	}
	public path(): String {
		return this.channel.path();
	}
}

export type TGrabberAsyncEvents = 'progress' | 'notification';
export type TGrabberAsyncEventObject = TGrabberAsyncEvents;

export function createGrabberAsync(
	fileToGrab: string,
): CancelablePromise<RustGrabberClass, void, TGrabberAsyncEvents, TGrabberAsyncEventObject> {
	return new CancelablePromise<
		RustGrabberClass,
		void,
		TGrabberAsyncEvents,
		TGrabberAsyncEventObject
	>((resolve, reject, cancel, refCancelCB, self) => {
		const grabber = new RustGrabberClass(fileToGrab);
		try {
			// Add cancel callback
			refCancelCB(() => {
				// Cancelation is started, but not canceled
				log(`Get command "break" operation. Starting breaking.`);
				grabber.computation.requestShutdown();
			});
			let totalTicks = 1;
			grabber.computation.onProgress((ticks: ITicks) => {
				totalTicks = ticks.total;
				self.emit('progress', ticks);
			});
			grabber.computation.onStopped(() => {
				cancel();
			});
			grabber.computation.onNotification((notification: INeonNotification) => {
				self.emit('notification', notification);
			});
			grabber.computation.onFinished(() => {
				self.emit('progress', {
					ellapsed: totalTicks,
					total: totalTicks
				});
				resolve(grabber);
			});
			// finally trigger the async function
			grabber.create_metadata();
		} catch (err) {
			if (!(err instanceof Error)) {
				log(`grabber operation is stopped. Error isn't valid:`);
				log(err);
				err = new Error(`grabber operation is stopped. Error isn't valid.`);
			} else {
				log(`grabber operation is stopped due error: ${err.message}`);
			}
			// Operation is rejected
			grabber.computation.requestShutdown();
			reject(err);
		}
	});
}