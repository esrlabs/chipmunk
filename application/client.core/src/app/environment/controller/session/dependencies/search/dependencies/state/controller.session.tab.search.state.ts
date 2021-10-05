import * as Toolkit from 'chipmunk.client.toolkit';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

export interface ITask {
    task: () => Promise<void>;
    id: string;
}

export class ControllerSessionTabSearchQueue implements Dependency {
    private _logger: Toolkit.Logger;
    private _uuid: string;
    private _progress: string | undefined;
    private _tasks: ITask[] = [];
    private _locked: boolean = false;
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        this._uuid = uuid;
        this._accessor = {
            session,
            search,
        };
        this._logger = new Toolkit.Logger(`SearchState [${uuid}]`);
    }

    public init(): Promise<void> {
        return Promise.resolve();
    }

    public destroy(): Promise<void> {
        this._tasks = [];
        return Promise.resolve();
    }

    public getName(): string {
        return 'SearchState';
    }

    public getId(): string | undefined {
        return this._progress;
    }

    public add(id: string, task: () => Promise<void>) {
        this._tasks.push({
            task,
            id,
        });
        this._next();
    }

    public equal(id: string): boolean {
        return this._progress === id;
    }

    public lock() {
        this._locked = true;
    }

    public unlock() {
        this._locked = false;
    }

    public isLocked(): boolean {
        return this._locked;
    }

    public _next() {
        if (this._tasks.length === 0) {
            return;
        }
        if (this._progress !== undefined) {
            return;
        }
        const task = this._tasks.splice(0, 1)[0];
        this._progress = task.id;
        const started = Date.now();
        task.task()
            .then(() => {
                this._logger.env(
                    `Search "${this._progress}" done in: ${((Date.now() - started) / 1000).toFixed(
                        2,
                    )}s`,
                );
            })
            .catch((err: Error) => {
                this._logger.warn(
                    `Search "${this._progress}" is finished in: ${(
                        (Date.now() - started) /
                        1000
                    ).toFixed(2)}s) with error: ${err.message}`,
                );
            })
            .finally(() => {
                this._progress = undefined;
                this._next();
            });
    }
}
