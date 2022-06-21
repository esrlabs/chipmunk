import { Queue } from 'platform/env/queue';
import { SetupLogger, LoggerInterface } from 'platform/entity/logger';

import * as fs from 'fs';
import * as path from 'path';

@SetupLogger()
export class FileController {
    public readonly filename: string;

    private _queue!: Queue;

    constructor(filename: string) {
        this.filename = filename;
    }

    public init(): FileController {
        this._queue = new Queue(this.log());
        this.setLoggerName(`Accessor ("${path.basename(this.filename)}")`);
        return this;
    }

    public destroy(): Promise<void> {
        return this._queue.destroy();
    }

    public read(): Promise<string> {
        if (this._queue.isLocked()) {
            return Promise.reject(new Error(`Storage is locked`));
        }
        if (!fs.existsSync(this.filename)) {
            return Promise.resolve('');
        }
        return fs.promises.readFile(this.filename, { encoding: 'utf-8' });
    }

    public write(content: string): Error | undefined {
        if (this._queue.isLocked()) {
            return new Error(`Storage is locked`);
        }
        this._queue.add(() => {
            return fs.promises
                .writeFile(this.filename, content, { encoding: 'utf-8' })
                .catch((err: Error) => {
                    this.log().error(`Fail to write data into "${this.filename}": ${err.message}`);
                });
        });
        return undefined;
    }

    public delete(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._queue.destroy().then(() => {
                fs.promises.unlink(this.filename).then(resolve).catch(reject);
            });
        });
    }
}
export interface FileController extends LoggerInterface {}
