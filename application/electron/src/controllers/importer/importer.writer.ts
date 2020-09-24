import * as FS from '../../tools/fs';

import Logger from '../../tools/env.logger';

export class ImporterWriter {

    private _tasks: Map<string, string[]> = new Map();
    private _locks: { [key: string]: boolean } = {};
    private _logger: Logger = new Logger('ImporterWriter');

    public write(filename: string, content: string) {
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
    }

}
