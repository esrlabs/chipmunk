import getGuid from './tools.guid';
import Logger from './env.logger';

export class PromisesQueue {

    private _tasks: Map<string, Promise<any>> = new Map();
    private _pending: Array<() => any> = [];
    private _logger: Logger;

    constructor(alias: string) {
        this._logger = new Logger(alias);
    }

    public add(task: Promise<any>, guid?: string): Promise<any> {
        const id = typeof guid !== 'string' ? getGuid() : guid;
        this._tasks.set(id, task);
        task.catch(() => {
            this._remove(id);
        }).then(() => {
            this._remove(id);
        });
        return task;
    }

    public do(callback: () => any) {
        if (this._tasks.size > 0) {
            this._logger.debug(`Cannot start callback because still have a tasks in queue (count - ${this._tasks.size});`)
            this._pending.push(callback);
        } else {
            callback();
        }
    }

    public has(guid: string) {
        return this._tasks.has(guid);
    }

    private _remove(guid: string) {
        this._tasks.delete(guid);
        if (this._tasks.size === 0) {
            this._pending.forEach((callback: () => any) => {
                callback();
            });
            this._pending = [];
        }
    }

}
