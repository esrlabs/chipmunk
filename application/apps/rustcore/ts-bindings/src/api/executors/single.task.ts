import { ICancelablePromise, CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

export abstract class TaskManager<T, R> {
    protected queue: {
        args: T;
        task: ICancelablePromise<R>;
    }[] = [];
    protected running: ICancelablePromise<R> | undefined;
    protected dropping: boolean = false;
    protected readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public destroy(): Promise<void> {
        return this.drop();
    }

    public drop(): Promise<void> {
        this.dropping = true;
        const pendings = this.queue.map((t) => t.task);
        if (this.running !== undefined) {
            pendings.push(this.running);
        }
        return Promise.all(
            pendings.map((task) => {
                return new Promise((resolve) => {
                    task.finally(() => resolve(undefined));
                    task.abort();
                });
            }),
        )
            .catch((err: Error) => {
                this.logger.error(`Fail to drop all task: ${err.message}`);
            })
            .then(() => {
                return Promise.resolve();
            })
            .finally(() => {
                this.dropping = false;
            });
    }

    public run(args: T): ICancelablePromise<R> {
        if (this.dropping) {
            return new CancelablePromise((_resolve, _reject, cancel, _refCancel, _self) => {
                cancel();
            });
        }
        // Check current task
        if (this.running !== undefined) {
            this.running.abort();
        }
        return new CancelablePromise((_resolve, _reject, _cancel, _refCancel, self) => {
            // Put task into queue
            this.queue.push({ args, task: self });
            // Try to next
            this.next();
        });
    }

    protected next(): void {
        // Check current task
        if (this.running !== undefined) {
            return;
        }
        // Get latest task
        const task = this.queue.pop();
        if (task === undefined) {
            return;
        }
        // Drop rest task
        this.queue.forEach((pending) => {
            pending.task.abort();
        });
        this.queue = [];
        // Run search
        this.running = this.executor(task.args)
            .finally(() => {
                this.running = undefined;
                this.next();
            })
            .bind(task.task);
        task.task.uuid(this.running.uuid());
    }

    abstract executor(args: T): ICancelablePromise<R>;
}
