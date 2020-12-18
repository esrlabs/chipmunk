import getGuid from './tools.guid';
import Logger from './env.logger';

export type TTaskExecutor = () => Promise<any>;

export type TResolver = () => void;

export interface ITask {
    guid: string;
    alias: string;
    task: TTaskExecutor;
}

export class PromisesSuccessiveQueue {

    private _tasks: Map<string, ITask> = new Map();
    private _destroy: TResolver | undefined;
    private _locked: boolean = false;
    private _logger: Logger;

    constructor(alias: string) {
        this._logger = new Logger(alias);
    }

    public add(task: TTaskExecutor, guid?: string, alias?: string) {
        if (this._locked) {
            this._logger.warn(`Queue is locked.`);
            return;
        }
        const _guid = typeof guid !== 'string' ? getGuid() : guid;
        const _alias = typeof alias !== 'string' ? `no_name` : alias;
        this._tasks.set(_guid, {
            guid: _guid,
            alias: _alias,
            task: task,
        });
        if (this._tasks.size === 1) {
            return this._proceed();
        }
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._locked) {
                return reject(new Error(this._logger.warn(`Queue is already locked.`)));
            }
            this._locked = true;
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

    private _proceed() {
        this._logger.verbose(`Tasks in queue: ${this._tasks.size}`);
        if (this._tasks.size === 0) {
            if (this._destroy !== undefined) {
                this._destroy();
            }
            return;
        }
        const next: ITask = this._tasks.values().next().value;
        next.task().finally(() => {
            this._logger.verbose(`Tasks "${next.alias}/${next.guid}" is done`);
            this._tasks.delete(next.guid);
            this._proceed();
        });
    }


}
