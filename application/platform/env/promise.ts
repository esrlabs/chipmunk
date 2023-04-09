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
    tryToStopCancellation(): boolean;
    asPromise(): Promise<T>;
    grab(): {
        resolve: (boundCall: boolean, value: T) => void;
        reject: (boundCall: boolean, error: Error) => void;
        cancel: (boundCall: boolean, reason?: C) => void;
        finally: (boundCall: boolean) => void;
    };
    bind(
        source: ICancelablePromise<T, C, EN, EH>,
        boundCall?: boolean,
    ): CancelablePromise<T, C, EN, EH>;
}

class PromiseBinding<T = void, C = void, EN = string, EH = TEventHandler> {
    protected readonly bound: CancelablePromise<T, C, EN, EH>[] = [];

    public bind(
        source: ICancelablePromise<T, C, EN, EH>,
        boundCall?: boolean,
    ): CancelablePromise<T, C, EN, EH> {
        this.bound.push(source as CancelablePromise<T, C, EN, EH>);
        !(boundCall === undefined ? false : boundCall) && source.bind(this.promise(), true);
        return this.promise();
    }

    protected promise(): CancelablePromise<T, C, EN, EH> {
        return this as unknown as CancelablePromise<T, C, EN, EH>;
    }
}

class PromiseResolutions<
    T = void,
    C = void,
    EN = string,
    EH = TEventHandler,
> extends PromiseBinding<T, C, EN, EH> {
    protected readonly resolvers: Array<TResolver<T>> = [];
    protected readonly rejectors: TRejector[] = [];
    protected readonly cancelers: Array<TCanceler<C>> = [];
    protected readonly finishes: TFinally[] = [];
    protected resolved: boolean = false;
    protected rejected: boolean = false;
    protected finished: boolean = false;

    public then(callback: TResolver<T>): CancelablePromise<T, C, EN, EH> {
        this.resolvers.push(callback);
        return this.promise();
    }

    public catch(callback: TRejector): CancelablePromise<T, C, EN, EH> {
        this.rejectors.push(callback);
        return this.promise();
    }

    public finally(callback: TFinally): CancelablePromise<T, C, EN, EH> {
        this.finishes.push(callback);
        return this.promise();
    }

    public canceled(callback: TCanceler<C>): CancelablePromise<T, C, EN, EH> {
        this.cancelers.push(callback);
        return this.promise();
    }
}

class PromiseEvents<T = void, C = void, EN = string, EH = TEventHandler> extends PromiseResolutions<
    T,
    C,
    EN,
    EH
> {
    protected readonly handlers: Map<EN, EH[]> = new Map();

    public on(event: EN, handler: EH): CancelablePromise<T, C, EN, EH> {
        if (typeof event !== 'string' || event.trim() === '') {
            return this.promise();
        }
        if (typeof handler !== 'function') {
            return this.promise();
        }
        let handlers: any[] | undefined = this.handlers.get(event);
        if (handlers === undefined) {
            handlers = [];
        }
        handlers.push(handler);
        this.handlers.set(event, handlers);
        return this.promise();
    }

    public emit(event: EN, ...args: any[]): void {
        const handlers: EH[] | undefined = this.handlers.get(event);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: EH) => {
            if (typeof handler !== 'function') {
                return;
            }
            handler(...args);
        });
    }

    protected unsubscribe(): void {
        this.handlers.clear();
    }
}

class PromiseCancellation<
    T = void,
    C = void,
    EN = string,
    EH = TEventHandler,
> extends PromiseEvents<T, C, EN, EH> {
    protected delegation: TCanceler<C> | undefined;
    protected cancellation: {
        cancelled: boolean;
        cancelling: boolean;
    } = {
        cancelled: false,
        cancelling: false,
    };

    public tryToStopCancellation(): boolean {
        if (this.cancellation.cancelled) {
            return false;
        }
        this.cancellation.cancelling = false;
        return true;
    }

    public isCanceling(): boolean {
        return this.cancellation.cancelling || this.cancellation.cancelled;
    }

    protected tryToDelegateCancellation(reason?: C): boolean {
        const delegation: TCanceler<C> | undefined = this.findCancellationDelegation();
        if (delegation === undefined) {
            return false;
        }
        this.cancellation.cancelling = true;
        delegation(reason);
        return true;
    }

    protected setCancellationDelegation(delegation: TCanceler<C>) {
        this.delegation = delegation;
    }

    protected getCancellationDelegation(): TCanceler<C> | undefined {
        return this.delegation;
    }

    protected findCancellationDelegation(): TCanceler<C> | undefined {
        const delegations: TCanceler<C>[] = this.bound
            .map((bound) => bound.getCancellationDelegation())
            .filter((delegation) => delegation !== undefined) as TCanceler<C>[];
        this.delegation !== undefined && delegations.push(this.delegation);
        if (delegations.length === 0) {
            return undefined;
        }
        if (delegations.length !== 1) {
            throw new Error(
                `Multiple delegation callbacks are defined for bound promises. Only one can be defined.`,
            );
        }
        return delegations[0];
    }
}

class PromiseStates<
    T = void,
    C = void,
    EN = string,
    EH = TEventHandler,
> extends PromiseCancellation<T, C, EN, EH> {
    public isProcessing(): boolean {
        if (this.resolved || this.rejected || this.finished || this.cancellation.cancelled) {
            return false;
        }
        return true;
    }

    public isCompleted(): boolean {
        return !this.isProcessing();
    }

    protected set(): {
        resolved(): void;
        rejected(): void;
        finished(): void;
        cancelling(): void;
        cancelled(): void;
    } {
        return {
            resolved: (): void => {
                this.resolved = true;
            },
            rejected: (): void => {
                this.rejected = true;
            },
            finished: (): void => {
                this.finished = true;
            },
            cancelling: (): void => {
                this.cancellation.cancelling = true;
            },
            cancelled: (): void => {
                this.cancellation.cancelled = true;
            },
        };
    }
}

class PromiseWorkflow<T = void, C = void, EN = string, EH = TEventHandler> extends PromiseStates<
    T,
    C,
    EN,
    EH
> {
    protected doResolve(boundCall: boolean, value: T) {
        this.unsubscribe();
        if (this.isCanceling() || this.isCompleted()) {
            return;
        }
        this.set().resolved();
        this.resolvers.forEach((resolver: TResolver<T>) => resolver(value));
        !boundCall && this.bound.forEach((bound) => bound.grab().resolve(true, value));
        this.doFinally(false);
    }

    protected doReject(boundCall: boolean, error: Error) {
        this.unsubscribe();
        if (this.isCanceling() || this.isCompleted()) {
            return;
        }
        this.set().rejected();
        this.rejectors.forEach((rejector: TRejector) => rejector(error));
        !boundCall && this.bound.forEach((bound) => bound.grab().reject(true, error));
        this.doFinally(false);
    }

    protected doFinally(boundCall: boolean) {
        this.unsubscribe();
        if (this.finished) {
            return;
        }
        this.set().finished();
        this.finishes.forEach((final: TFinally) => final());
        !boundCall && this.bound.forEach((bound) => bound.grab().finally(true));
    }

    protected doCancel(boundCall: boolean, reason?: C) {
        this.unsubscribe();
        if (this.resolved || this.rejected || this.cancellation.cancelled) {
            // Doesn't make sence to cancel, because it was resolved or rejected or canceled already
            return;
        }
        this.set().cancelled();
        this.cancelers.forEach((cancler: TCanceler<C>) => cancler(reason));
        !boundCall && this.bound.forEach((bound) => bound.grab().cancel(true, reason));
        this.doFinally(false);
    }

    public abort(reason: C): CancelablePromise<T, C, EN, EH> {
        if (this.isCompleted()) {
            return this.promise();
        }
        if (this.isCanceling()) {
            return this.promise();
        }
        if (!this.tryToDelegateCancellation(reason)) {
            this.doCancel(false, reason);
        }
        return this.promise();
    }

    public grab(): {
        resolve: (boundCall: boolean, value: T) => void;
        reject: (boundCall: boolean, error: Error) => void;
        cancel: (boundCall: boolean, reason?: C) => void;
        finally: (boundCall: boolean) => void;
    } {
        return {
            resolve: this.doResolve.bind(this),
            reject: this.doReject.bind(this),
            cancel: this.doCancel.bind(this),
            finally: this.doFinally.bind(this),
        };
    }
}

export class CancelablePromise<T = void, C = void, EN = string, EH = TEventHandler>
    extends PromiseWorkflow<T, C, EN, EH>
    implements ICancelablePromise<T, C, EN, EH>
{
    private _uuid: string = unique();

    constructor(executor: TExecutor<T, C, EN, EH>) {
        super();
        const self = this;
        // Create and execute native promise
        new Promise<T>((resolve: TResolver<T>, reject: TRejector) => {
            executor(
                resolve,
                reject,
                this.doCancel.bind(this, false),
                this.setCancellationDelegation.bind(this),
                self as unknown as CancelablePromise<T, C, EN, EH>,
            );
        })
            .then(this.doResolve.bind(this, false))
            .catch(this.doReject.bind(this, false));
    }

    public uuid(uuid?: string): string {
        if (typeof uuid === 'string') {
            this._uuid = uuid;
        }
        return this._uuid;
    }

    public asPromise(): Promise<T> {
        return new Promise((resolve, reject) => {
            this.then(resolve);
            this.catch(reject);
            this.canceled(() => {
                reject(new Error(`Promise is cancelled`));
            });
        });
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
