import UUID from './uuid';

export type TResolver<T> = (value: T) => void;
export type TRejector = (error: Error) => void;
export type TFinally = () => void;
export type TCanceler<T> = (reason?: T) => void;
export type TExecutor<T, C, EN, EH> = (resolve: TResolver<T>, reject: TRejector, cancel: TCanceler<C>, refCancelCB: (cb: TCanceler<C>) => void, self: CancelablePromise<T, C, EN, EH>) => void;
export type TEventHandler = (...args: any[]) => any;

export class CancelablePromise<T = void, C = void, EN = string, EH = TEventHandler> {

    private readonly _resolvers: Array<TResolver<T>> = [];
    private readonly _rejectors: TRejector[] = [];
    private readonly _cancelers: Array<TCanceler<C>> = [];
    private readonly _finishes: TFinally[] = [];
    private readonly _handlers: Map<EN, EH[]> = new Map();
    private readonly _uuid: string = UUID();
    private _cancellation: TCanceler<C> | undefined;
    private _canceled: boolean = false;
    private _canceling: boolean = false;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _finished: boolean = false;

    constructor(
        executor: TExecutor<T, C, EN, EH>,
    ) {
        const self = this;
        // Create and execute native promise
        new Promise<T>((resolve: TResolver<T>, reject: TRejector) => {
            executor(resolve, reject, this._doCancel.bind(this), this._refCancellationCallback.bind(this), self);
        }).then((value: T) => {
            this._doResolve(value);
        }).catch((error: Error) => {
            this._doReject(error);
        });
    }

    public then(callback: TResolver<T>): CancelablePromise<T, C, EN, EH> {
        this._resolvers.push(callback);
        return this;
    }

    public catch(callback: TRejector): CancelablePromise<T, C, EN, EH> {
        this._rejectors.push(callback);
        return this;
    }

    public finally(callback: TFinally): CancelablePromise<T, C, EN, EH> {
        this._finishes.push(callback);
        return this;
    }

    public canceled(callback: TCanceler<C>): CancelablePromise<T, C, EN, EH> {
        this._cancelers.push(callback);
        return this;
    }

    public abort(reason: C): CancelablePromise<T, C, EN, EH> {
        if (this._cancellation === undefined) {
            this._doCancel(reason);
        } else {
            this._doCancellation(reason);
        }
        return this;
    }

    public on(event: EN, handler: EH): CancelablePromise<T, C, EN, EH> {
        if (typeof event !== 'string' || event.trim() === '') {
            return this;
        }
        if (typeof handler !== 'function') {
            return this;
        }
        let handlers: any[] | undefined = this._handlers.get(event);
        if (handlers === undefined) {
            handlers = [];
        }
        handlers.push(handler);
        this._handlers.set(event, handlers);
        return this;
    }

    public isProcessing(): boolean {
        if (this._resolved || this._rejected || this._canceled || this._canceling) {
            return false;
        }
        return true;
    }

    public isCanceling(): boolean {
        return this._canceling || this._canceled;
    }

    public emit(event: EN, ...args: any[]): void {
        const handlers: EH[] | undefined = this._handlers.get(event);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: EH) => {
            if (typeof handler !== 'function') {
                return;
            }
            try {
                handler(...args);
            } catch (e) {
                this._doReject(new Error(`Promise is rejected, because handler of event "${event}" finished due error: ${e.message}`));
            }
        });
    }

    public getUUID(): string {
        return this._uuid;
    }

    private _refCancellationCallback(callback: TCanceler<C>) {
        this._cancellation = callback;
    }

    private _doResolve(value: T) {
        this._handlers.clear();
        if (this._canceled || this._canceling) {
            return;
        }
        this._resolved = true;
        this._resolvers.forEach((resolver: TResolver<T>) => {
            resolver(value);
        });
        this._doFinally();
    }

    private _doReject(error: Error) {
        this._handlers.clear();
        if (this._canceled || this._canceling) {
            return;
        }
        this._rejected = true;
        this._rejectors.forEach((rejector: TRejector) => {
            rejector(error);
        });
        this._doFinally();
    }

    private _doFinally() {
        this._handlers.clear();
        if (this._finished) {
            return;
        }
        this._finished = true;
        this._finishes.forEach((handler: TFinally) => {
            handler();
        });
    }

    private _doCancel(reason?: C) {
        this._handlers.clear();
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

    private _doCancellation(reason?: C) {
        this._handlers.clear();
        if (this._cancellation === undefined) {
            return this;
        }
        if (this._resolved || this._rejected || this._canceled || this._canceling) {
            // Doesn't make sence to cancel, because it was resolved or rejected or canceled already
            return this;
        }
        this._canceling = true;
        this._cancellation(reason);
    }

}
