import { unique } from './sequence';

export type TResolver<T> = (value: T) => void;

export type TRejector = (error: Error) => void;

export type TFinally = () => void;

export type TCanceler<T> = (reason?: T) => void;

export type TExecutor<T, C, EN, EH> = (
    resolve: TResolver<T>,
    reject: TRejector,
    cancel: TCanceler<C>,
    refCancelCB: (cb: TCanceler<C>) => void,
    self: CancelablePromise<T, C, EN, EH>,
) => void;

export type TEventHandler = (...args: any[]) => any;

export interface ICancelablePromise<T = void, C = void, EN = string, EH = TEventHandler> {
    // new (executor: TExecutor<T, C, EN, EH>): CancelablePromise<T, C, EN, EH>;
    then(callback: TResolver<T>): CancelablePromise<T, C, EN, EH>;
    catch(callback: TRejector): CancelablePromise<T, C, EN, EH>;
    finally(callback: TFinally): CancelablePromise<T, C, EN, EH>;
    canceled(callback: TCanceler<C>): CancelablePromise<T, C, EN, EH>;
    abort(reason: C): CancelablePromise<T, C, EN, EH>;
    on(event: EN, handler: EH): CancelablePromise<T, C, EN, EH>;
    isProcessing(): boolean;
    isCompleted(): boolean;
    isCanceling(): boolean;
    emit(event: EN, ...args: any[]): void;
    uuid(uuid?: string): string;
    stopCancelation(): void;
    grab(): {
        resolvers: Array<TResolver<T>>;
        rejectors: TRejector[];
        cancelers: Array<TCanceler<C>>;
        finishes: TFinally[];
    };
    bind(source: ICancelablePromise<T, C, EN, EH>): CancelablePromise<T, C, EN, EH>;
}

export class CancelablePromise<T = void, C = void, EN = string, EH = TEventHandler>
    implements ICancelablePromise<T, C, EN, EH>
{
    protected readonly _resolvers: Array<TResolver<T>> = [];
    protected readonly _rejectors: TRejector[] = [];
    protected readonly _cancelers: Array<TCanceler<C>> = [];
    protected readonly _finishes: TFinally[] = [];
    protected readonly _handlers: Map<EN, EH[]> = new Map();
    protected readonly _bound: ICancelablePromise<T, C, EN, EH>[] = [];
    protected _cancellation: TCanceler<C> | undefined;
    private _uuid: string = unique();
    private _canceled: boolean = false;
    private _canceling: boolean = false;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _finished: boolean = false;

    constructor(executor: TExecutor<T, C, EN, EH>) {
        const self = this;
        // Create and execute native promise
        new Promise<T>((resolve: TResolver<T>, reject: TRejector) => {
            executor(
                resolve,
                reject,
                this._doCancel.bind(this),
                this._refCancellationCallback.bind(this),
                self,
            );
        })
            .then((value: T) => {
                this._doResolve(value);
            })
            .catch((error: Error) => {
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

    public isCompleted(): boolean {
        return !this.isProcessing();
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
            } catch (err) {
                this._doReject(
                    new Error(
                        `Promise is rejected, because handler of event "${event}" finished due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            }
        });
    }

    public uuid(uuid?: string): string {
        if (typeof uuid === 'string') {
            this._uuid = uuid;
        }
        return this._uuid;
    }

    public stopCancelation(): void {
        this._canceled = false;
        this._canceling = false;
    }

    public bind(source: ICancelablePromise<T, C, EN, EH>): CancelablePromise<T, C, EN, EH> {
        this._bound.push(source);
        return this;
    }

    public grab(): {
        resolvers: Array<TResolver<T>>;
        rejectors: TRejector[];
        cancelers: Array<TCanceler<C>>;
        finishes: TFinally[];
    } {
        return {
            resolvers: this._resolvers,
            rejectors: this._rejectors,
            cancelers: this._cancelers,
            finishes: this._finishes,
        };
    }

    public asPromise(): Promise<T> {
        return new Promise((resolve, reject) => {
            this.then(resolve);
            this.catch(reject);
        });
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
        [...this._resolvers, ...this._bound.map((b) => b.grab().resolvers).flat()].forEach(
            (resolver: TResolver<T>) => {
                resolver(value);
            },
        );
        this._doFinally();
    }

    private _doReject(error: Error) {
        this._handlers.clear();
        if (this._canceled || this._canceling) {
            return;
        }
        this._rejected = true;
        [...this._rejectors, ...this._bound.map((b) => b.grab().rejectors).flat()].forEach(
            (rejector: TRejector) => {
                rejector(error);
            },
        );
        this._doFinally();
    }

    private _doFinally() {
        this._handlers.clear();
        if (this._finished) {
            return;
        }
        this._finished = true;
        [...this._finishes, ...this._bound.map((b) => b.grab().finishes).flat()].forEach(
            (handler: TFinally) => {
                handler();
            },
        );
    }

    private _doCancel(reason?: C) {
        this._handlers.clear();
        if (this._resolved || this._rejected || this._canceled) {
            // Doesn't make sence to cancel, because it was resolved or rejected or canceled already
            return;
        }
        this._canceled = true;
        [...this._cancelers, ...this._bound.map((b) => b.grab().cancelers).flat()].forEach(
            (cancler: TCanceler<C>) => {
                cancler(reason);
            },
        );
        this._doFinally();
    }

    private _doCancellation(reason?: C) {
        if (this._cancellation === undefined) {
            return;
        }
        if (this._resolved || this._rejected || this._canceled || this._canceling) {
            // Doesn't make sence to cancel, because it was resolved or rejected or canceled already
            return;
        }
        this._canceling = true;
        this._cancellation(reason);
    }
}

export class SingleTaskTracker<T> {
    private _running: ICancelablePromise<T> | undefined;
    private _aborting: boolean = false;

    public run(executor: () => ICancelablePromise<T>): Promise<void> {
        if (this._aborting) {
            return Promise.reject(new Error(`Current task is aborting`));
        }
        return new Promise((resolve) => {
            if (!this._running) {
                this._running = executor().finally(() => {
                    this._running = undefined;
                });
                return resolve();
            }
            this._aborting = true;
            this._running
                .finally(() => {
                    this._aborting = false;
                    this._running = executor().finally(() => {
                        this._running = undefined;
                    });
                    resolve();
                })
                .abort();
        });
    }

    public working(): boolean {
        return this._running !== undefined;
    }

    public abort(): Promise<void> {
        return new Promise((resolve) => {
            if (this._running === undefined) {
                return resolve();
            }
            this._running.finally(resolve).abort();
        });
    }
}

export class JobsTracker<T = void, C = void, EN = string, EH = TEventHandler> {
    private readonly _jobs: Map<string, ICancelablePromise<T, C, EN, EH>> = new Map();

    public register(job: ICancelablePromise<T, C, EN, EH>) {
        const uuid = job.uuid();
        job.finally(() => {
            this._jobs.delete(uuid);
        });
        this._jobs.set(uuid, job);
    }

    public registerAsUnknown(job: unknown) {
        const trusted = job as ICancelablePromise<T, C, EN, EH>;
        const uuid = trusted.uuid();
        trusted.finally(() => {
            this._jobs.delete(uuid);
        });
        this._jobs.set(uuid, trusted);
    }

    public abort(reason: C): Promise<void> {
        return new Promise((resolve) => {
            if (this._jobs.size === 0) {
                return resolve();
            }
            this._jobs.forEach((job) => {
                job.finally(() => {
                    this._jobs.delete(job.uuid());
                    if (this._jobs.size === 0) {
                        resolve();
                    }
                });
                if (!job.isCompleted()) {
                    // Task wasn't canceled yet
                    job.abort(reason);
                }
            });
        });
    }
}

export type Executor<T> = (...args: any[]) => CancelablePromise<T>;

export interface IStat {
    actual: number;
    done: number;
    canceled: number;
    rejected: number;
}

export class PromiseExecutor<T> {
    private _proccessing: Map<string, CancelablePromise<T>> = new Map();
    private _stat: IStat = {
        actual: 0,
        done: 0,
        canceled: 0,
        rejected: 0,
    };

    public run(executor: Executor<T>): CancelablePromise<T> {
        const task = new CancelablePromise<T>((resolve, reject, cancel, cancelRef, self) => {
            if (self.isCanceling()) {
                // Task already was canceled
                // (we don't need to resolve/reject, it would be canceled)
                return;
            }
            this._abort(self.uuid())
                .then(() => {
                    if (self.isCanceling()) {
                        // Task already was canceled
                        // (we don't need to resolve/reject, it would be canceled)
                        return;
                    }
                    // Start internal task
                    const task = executor()
                        .then((res: T) => {
                            this._stat.done += 1;
                            resolve(res);
                        })
                        .catch(() => {
                            this._stat.rejected += 1;
                        });
                    // Set cancel reference (wrapper promise cannot be canceled while internal isn't)
                    cancelRef(() => {
                        if (!task.isProcessing()) {
                            // Already canceled
                            cancel();
                        } else {
                            // Still in progress
                            task.finally(() => {
                                cancel();
                            });
                            // Cancel if it's not
                            if (!task.isCanceling()) {
                                task.abort();
                            }
                        }
                    });
                })
                .catch(reject);
        })
            .canceled(() => {
                this._stat.canceled += 1;
            })
            .finally(() => {
                this._proccessing.delete(task.uuid());
            });
        this._proccessing.set(task.uuid(), task);
        return task;
    }

    public abort(): Promise<void> {
        return this._abort();
    }

    public getStat(): IStat {
        this._stat.actual = this._proccessing.size;
        return Object.assign({}, this._stat);
    }

    private _abort(exception?: string): Promise<void> {
        return new Promise((resolve) => {
            const tasks = Array.from(this._proccessing.values()).filter(
                (v) => v.uuid() !== exception,
            );
            let done = tasks.length;
            if (done === 0) {
                return resolve();
            }
            tasks.forEach((task) => {
                task.finally(() => {
                    this._proccessing.delete(task.uuid());
                    done -= 1;
                    if (done === 0) {
                        resolve();
                    }
                });
                if (!task.isCompleted()) {
                    // Task wasn't canceled yet
                    task.abort();
                }
            });
        });
    }
}
