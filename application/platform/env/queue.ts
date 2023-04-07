import { unique } from './sequence';
import { Logger } from '../log';
import { LockToken } from './lock.token';

export type TaskExecutor = () => Promise<any>;

export type Handler = () => void;

export interface Task {
    uuid: string;
    alias: string;
    task: TaskExecutor;
}

export class Queue {
    private readonly _tasks: Map<string, Task> = new Map();
    private _destroy: Handler | undefined;
    private readonly _locker: LockToken = LockToken.simple(false);
    private readonly _logger: Logger;

    constructor(logger: Logger) {
        this._logger = logger;
    }

    public add(task: TaskExecutor, uuid?: string, alias?: string) {
        if (this._locker.isLocked()) {
            this._logger.warn(`Queue is locked.`);
            return;
        }
        const _uuid = typeof uuid !== 'string' ? unique() : uuid;
        const _alias = typeof alias !== 'string' ? `no_name` : alias;
        this._tasks.set(_uuid, {
            uuid: _uuid,
            alias: _alias,
            task: task,
        });
        if (this._tasks.size === 1) {
            return this._proceed();
        }
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._locker.isLocked()) {
                return reject(new Error(this._logger.warn(`Queue is already locked.`)));
            }
            this._locker.lock();
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
        return this._locker.isLocked();
    }

    private _proceed() {
        this._logger.verbose(`Tasks in queue: ${this._tasks.size}`);
        if (this._tasks.size === 0) {
            if (this._destroy !== undefined) {
                this._destroy();
            }
            return;
        }
        const next: Task = this._tasks.values().next().value;
        next.task().finally(() => {
            this._logger.verbose(`Tasks "${next.alias}/${next.uuid}" is done`);
            this._tasks.delete(next.uuid);
            this._proceed();
        });
    }
}
