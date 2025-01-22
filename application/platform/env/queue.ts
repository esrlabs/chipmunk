import { unique } from './sequence';
import { Logger } from '../log';
import { LockToken } from './lock.token';

export type TaskExecutor = () => Promise<any>;

export type Handler = () => void;

export interface Task {
    uuid: string;
    alias: string | undefined;
    task: TaskExecutor;
}

const WARN_DURATION_MS = 1000;

export class Queue {
    private readonly _tasks: Map<string, Task> = new Map();
    private _destroy: Handler | undefined;
    private readonly _shutdown: LockToken = LockToken.simple(false);
    private readonly _logger: Logger;
    private readonly _processing: LockToken = LockToken.simple(false);

    constructor(logger: Logger) {
        this._logger = logger;
    }

    public add(task: TaskExecutor, uuid?: string, alias?: string) {
        if (this._shutdown.isLocked()) {
            this._logger.warn(`Attempt to add task in queue, but it's shutdown already.`);
            return;
        }
        const _uuid = typeof uuid !== 'string' ? unique() : uuid;
        this._tasks.set(_uuid, {
            uuid: _uuid,
            alias: typeof alias !== 'string' ? undefined : alias,
            task: task,
        });
        this._proceed();
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._shutdown.isLocked()) {
                return reject(new Error(this._logger.warn(`Queue is already shutdown.`)));
            }
            this._shutdown.lock();
            if (this._tasks.size === 0) {
                resolve();
            } else {
                this._destroy = resolve;
            }
        });
    }

    public has(guid: string) {
        return this._tasks.has(guid);
    }

    public isLocked(): boolean {
        return this._shutdown.isLocked();
    }

    private _proceed() {
        if (this._processing.isLocked()) {
            return;
        }
        this._logger.verbose(`Tasks in queue: ${this._tasks.size}`);
        const next: Task | undefined = this._tasks.values().next().value;
        if (this._tasks.size === 0 || next === undefined) {
            if (this._destroy !== undefined) {
                this._destroy();
            }
            return;
        }
        this._processing.lock();
        const ts = Date.now();
        next.task().finally(() => {
            const duration = Date.now() - ts;
            const alias = next.alias === undefined ? next.uuid : next.alias;
            if (duration > WARN_DURATION_MS) {
                this._logger.warn(`Task "${alias}" took much time to be done: ${duration}ms`);
            } else {
                this._logger.verbose(`Task "${alias}" is done in ${duration}ms`);
            }
            this._tasks.delete(next.uuid);
            this._processing.unlock();
            this._proceed();
        });
    }
}
