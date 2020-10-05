import { Lock } from '../../tools/env.lock';

import * as FS from '../../tools/fs';

import Logger from '../../tools/env.logger';

type TDestroyResolver = () => void;

export class ImporterWriter {

    private _tasks: Map<string, string[]> = new Map();
    private _locks: { [key: string]: boolean } = {};
    private _logger: Logger = new Logger('ImporterWriter');
    private _resolver: TDestroyResolver | undefined;
    private _locker: Lock = new Lock(false);

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            this._locker.lock();
            if (this._resolver !== undefined) {
                this._logger.warn(`Destroy method was called more than once.`);
                return;
            }
            if (this._tasks.size !== 0) {
                this._resolver = resolve;
            } else {
                resolve();
            }
        });
    }

    public write(filename: string, content: string) {
        if (this._locker.isLocked()) {
            return;
        }
        const pending: string[] | undefined = this._tasks.get(filename);
        if (pending !== undefined) {
            return pending.push(content);
        }
        this._tasks.set(filename, [content]);
        this._next();
    }

    private _next() {
        this._tasks.forEach((pending: string[], filename: string) => {
            if (this._locks[filename]) {
                return;
            }
            this._locks[filename] = true;
            FS.writeTextFile(filename, pending[0], true).catch((err: Error) => {
                this._logger.warn(`Fail write data into "${filename}" due error: ${err.message}`);
            }).finally(() => {
                pending.splice(0, 1);
                delete this._locks[filename];
                if (pending.length > 0) {
                    this._tasks.set(filename, pending);
                    this._next();
                } else {
                    this._tasks.delete(filename);
                }
            });
        });
        if (this._resolver !== undefined && this._tasks.size === 0) {
            this._resolver();
        }
    }

}
