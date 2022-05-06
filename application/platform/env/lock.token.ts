import { Subject } from './subscription';

export class LockToken {
    public static timeout(locked: boolean, timeout: number): LockToken {
        return new LockToken(locked, timeout);
    }
    public static simple(locked: boolean): LockToken {
        return new LockToken(locked, 0);
    }

    private _id: any = undefined;
    private _timeout: number;

    constructor(locked: boolean, timeout: number = 200) {
        this._id = locked ? -1 : undefined;
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

export type AbortHandler = () => void;
export class AsyncLockToken {
    private _locked: boolean;
    private _state: Subject<void> = new Subject();
    private _abort: AbortHandler | undefined;

    constructor(locked: boolean) {
        this._locked = locked;
    }

    public unlocked(): Promise<void> {
        if (!this.isLocked()) {
            return Promise.resolve();
        }
        if (this._abort !== undefined) {
            this._abort();
            this._abort = undefined;
        }
        return new Promise((resolve) => {
            const subscription = this._state.subscribe(() => {
                subscription.destroy();
                resolve();
            });
        });
    }

    public lock(handler?: AbortHandler) {
        this._abort = handler !== undefined ? handler : undefined;
        this._locked = true;
    }

    public unlock() {
        this._locked = false;
        this._state.emit();
    }

    public isLocked(): boolean {
        return this._locked;
    }
}
