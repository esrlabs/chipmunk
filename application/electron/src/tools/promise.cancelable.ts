export type TResolver<T> = (value: T) => void;
export type TRejector = (error: Error) => void;
export type TFinally = () => void;
export type TCanceler<T> = (reason?: T) => void;

export class CancelablePromise<T, C> {

    private _resolvers: Array<TResolver<T>> = [];
    private _rejectors: TRejector[] = [];
    private _cancelers: Array<TCanceler<C>> = [];
    private _finishes: TFinally[] = [];
    private _canceled: boolean = false;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _finished: boolean = false;

    constructor(
        executor: (resolve: TResolver<T>, reject: TRejector, cancel: TCanceler<C>, self: CancelablePromise<T, C>) => void,
    ) {
        const self = this;
        // Create and execute native promise
        new Promise<T>((resolve: TResolver<T>, reject: TRejector) => {
            executor(resolve, reject, this._doCancel.bind(this), self);
        }).then((value: T) => {
            this._doResolve(value);
        }).catch((error: Error) => {
            this._doReject(error);
        });
    }

    public then(callback: TResolver<T>): CancelablePromise<T, C> {
        this._resolvers.push(callback);
        return this;
    }

    public catch(callback: TRejector): CancelablePromise<T, C> {
        this._rejectors.push(callback);
        return this;
    }

    public finally(callback: TFinally): CancelablePromise<T, C> {
        this._finishes.push(callback);
        return this;
    }

    public cancel(callback: TCanceler<C>): CancelablePromise<T, C> {
        this._cancelers.push(callback);
        return this;
    }

    public break(reason: C): CancelablePromise<T, C> {
        this._doCancel(reason);
        return this;
    }

    private _doResolve(value: T) {
        if (this._canceled) {
            return;
        }
        this._resolved = true;
        this._resolvers.forEach((resolver: TResolver<T>) => {
            resolver(value);
        });
        this._doFinally();
    }

    private _doReject(error: Error) {
        if (this._canceled) {
            return;
        }
        this._rejected = true;
        this._rejectors.forEach((rejector: TRejector) => {
            rejector(error);
        });
        this._doFinally();
    }

    private _doFinally() {
        if (this._finished) {
            return;
        }
        this._finished = true;
        this._finishes.forEach((handler: TFinally) => {
            handler();
        });
    }

    private _doCancel(reason?: C) {
        if (this._resolved || this._rejected || this._canceled) {
            // Doesn't make sence to cancel, because it was resolved or rejected or canceled already
            return this;
        }
        this._canceled = true;
        this._cancelers.forEach((cancler: TCanceler<C>) => {
            cancler(reason);
        });
        this._doFinally();
    }

}
