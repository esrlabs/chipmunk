import { Queue } from 'platform/env/queue';
import { SetupLogger, LoggerInterface } from 'platform/entity/logger';

import * as fs from 'fs';
import * as path from 'path';

const WARN_WRITE_DURATION_MS = 500;

@SetupLogger()
export class FileController {
    public readonly filename: string;

    private _queue!: Queue;

    constructor(filename: string) {
        this.filename = filename;
    }

    public init(): FileController {
        this.setLoggerName(`Accessor ("${path.basename(this.filename)}")`);
        this._queue = new Queue(this.log());
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
            const ts = Date.now();
            return fs.promises
                .writeFile(this.filename, content, { encoding: 'utf-8' })
                .then(() => {
                    const duration = Date.now() - ts;
                    if (duration > WARN_WRITE_DURATION_MS) {
                        this.log().warn(
                            `Writing of ~${content.length}b took too long time: ${duration}ms`,
                        );
                    } else {
                        this.log().verbose(`~${content.length}b written in: ${Date.now() - ts}ms`);
                    }
                })
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
