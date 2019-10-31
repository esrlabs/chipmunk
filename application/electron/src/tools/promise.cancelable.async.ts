export type TResolver<T> = (value: T) => void;
export type TRejector = (error: Error) => void;
export type TFinally<F> = (result?: F) => void;
export type TCanceler<T> = (reason?: T) => void;
export type TExecutor<T, C, F> = (resolve: TResolver<T>, reject: TRejector, cancel: TCanceler<C>, finish: TFinally<F>, self: CancelableAsyncPromise<T, C, F>) => void;
export interface ICancelableAsyncPromiseOptions {
    autoFinallyOnResolve?: boolean;
    autoFinallyOnReject?: boolean;
    autoFinallyOnCancel?: boolean;
}
export class CancelableAsyncPromise<T, C, F> {

    private _resolvers: Array<TResolver<T>> = [];
    private _rejectors: TRejector[] = [];
    private _cancelers: Array<TCanceler<C>> = [];
    private _finishes: Array<TFinally<F>> = [];
    private _canceled: boolean = false;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _finished: boolean = false;
    private _options: ICancelableAsyncPromiseOptions;

    constructor(
        executor: TExecutor<T, C, F>,
        options?: ICancelableAsyncPromiseOptions,
    ) {
        const self = this;
        this._options = this._getDefaultOptions(options);
        // Create and execute native promise
        new Promise<T>((resolve: TResolver<T>, reject: TRejector) => {
            executor(resolve, reject, this._doCancel.bind(this), this._doFinally.bind(this), self);
        }).then((value: T) => {
            this._doResolve(value);
        }).catch((error: Error) => {
            this._doReject(error);
        });
    }

    public then(callback: TResolver<T>): CancelableAsyncPromise<T, C, F> {
        this._resolvers.push(callback);
        return this;
    }

    public catch(callback: TRejector): CancelableAsyncPromise<T, C, F> {
        this._rejectors.push(callback);
        return this;
    }

    public finally(callback: TFinally<F>): CancelableAsyncPromise<T, C, F> {
        this._finishes.push(callback);
        return this;
    }

    public cancel(callback: TCanceler<C>): CancelableAsyncPromise<T, C, F> {
        this._cancelers.push(callback);
        return this;
    }

    public isCanceled(): boolean {
        return this._canceled;
    }

    public break(reason: C): CancelableAsyncPromise<T, C, F> {
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
        if (this._options.autoFinallyOnResolve) {
            this._doFinally();
        }
    }

    private _doReject(error: Error) {
        if (this._canceled) {
            return;
        }
        this._rejected = true;
        this._rejectors.forEach((rejector: TRejector) => {
            rejector(error);
        });
        if (this._options.autoFinallyOnReject) {
            this._doFinally();
        }
    }

    private _doFinally() {
        if (this._finished) {
            return;
        }
        this._finished = true;
        this._finishes.forEach((handler: TFinally<F>) => {
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
        if (this._options.autoFinallyOnCancel) {
            this._doFinally();
        }
    }

    private _getDefaultOptions(options?: ICancelableAsyncPromiseOptions): ICancelableAsyncPromiseOptions {
        if (typeof options !== 'object' || options === null) {
            options = {
                autoFinallyOnCancel: false,
                autoFinallyOnReject: true,
                autoFinallyOnResolve: true,
            };
        } else {
            if (typeof options.autoFinallyOnCancel !== 'boolean') { options.autoFinallyOnCancel = false; }
            if (typeof options.autoFinallyOnReject !== 'boolean') { options.autoFinallyOnReject = true; }
            if (typeof options.autoFinallyOnResolve !== 'boolean') { options.autoFinallyOnResolve = true; }
        }
        return Object.assign({}, options);
    }

}
