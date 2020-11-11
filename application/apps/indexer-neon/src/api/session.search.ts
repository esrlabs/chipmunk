import * as Logs from '../util/logging';

import { RustSessionChannel } from '../native/index';
import { CancelablePromise } from '../util/promise';
import { SessionComputation } from './session.computation';

export interface IFilterFlags {
	reg: boolean,
	word: boolean,
	cases: boolean,
}

export interface IFilter {
	filter: string,
	flags: IFilterFlags,
}

export class SessionSearch {
	
	private readonly _computation: SessionComputation;
	private readonly _channel: RustSessionChannel;
	private readonly _uuid: string;
	private readonly _logger: Logs.Logger;
	
	constructor(computation: SessionComputation, channel: RustSessionChannel, uuid: string) {
		this._logger = Logs.getLogger(`SessionSearch: ${uuid}`);
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
		return this._channel.grabSearch(line_index, line_count);
	}


	public search(filters: IFilter): CancelablePromise {
		return new CancelablePromise(() => {
			// Overwrite search results
		});
	}

	public matches(filters: IFilter): CancelablePromise {
		return new CancelablePromise(() => {
			// Should return all found matches
			// But SHOULD NOT drop search results of main search
			// This is independent search
		});
	}

	public positions(): CancelablePromise {
		return new CancelablePromise(() => {
			// Should return row numbers for all found matches
			// Based on main search
		});
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