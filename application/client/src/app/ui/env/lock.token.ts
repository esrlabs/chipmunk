export class LockToken {
	private _id: any = undefined;
	private _timeout: number;

	constructor(timeout: number = 200) {
		this._timeout = timeout;
	}

	public lock() {
		if (this._timeout > 0) {
			this._id = setTimeout(() => {
				this._id = undefined;
			}, this._timeout);
		} else {
			this._id = -1;
		}
	}

	public unlock() {
		clearTimeout(this._id);
		this._id = undefined;
	}

	public isLocked(): boolean {
		return this._id !== undefined;
	}
}
