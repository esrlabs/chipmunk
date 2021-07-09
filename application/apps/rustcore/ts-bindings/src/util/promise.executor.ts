import { CancelablePromise } from "./promise";

export type TExecutor<T> = (...args: any[]) => CancelablePromise<T>;

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

    public run(executor: TExecutor<T>): CancelablePromise<T> {
        const task = new CancelablePromise<T>((resolve, reject, cancel, cancelRef, self) => {
            if (self.isCanceling()) {
                // Task already was canceled
                // (we don't need to resolve/reject, it would be canceled)
                return;
            }
            this._abort(self.getUUID()).then(() => {
                if (self.isCanceling()) {
                    // Task already was canceled
                    // (we don't need to resolve/reject, it would be canceled)
                    return;
                }
                // Start internal task
                const task = executor().then((res: T) => {
                    this._stat.done += 1;
                    resolve(res);
                }).catch((err: Error) => {
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
            }).catch(reject);
        }).canceled(() => {
            this._stat.canceled += 1;
        }).finally(() => {
            this._proccessing.delete(task.getUUID());
        });
        this._proccessing.set(task.getUUID(), task);
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
            const tasks = Array.from(this._proccessing.values()).filter(v => v.getUUID() !== exception);
            let done = tasks.length;
            if (done === 0) {
                return resolve();
            }
            tasks.forEach((task) => {
                task.finally(() => {
                    this._proccessing.delete(task.getUUID());
                    done -= 1;
                    if (done === 0) {
                        resolve();
                    }
                });
                if (!task.isCanceling()) {
                    // Task wasn't canceled yet
                    task.abort();
                }    
            });
        });
    }

}
