import { StreamController } from '../fs/stream';
import { scope } from 'platform/env/scope';

import * as fs from 'fs';

export class FileStore {
    static SIZE_LIMIT = 1024 * 1024 * 10;

    protected pending = '';
    protected stream: StreamController | undefined;

    public bind(filename: string) {
        const logger = scope.getLogger('LogFileStore');
        const bind = () => {
            this.stream = new StreamController(filename).init();
            logger.debug(`bound with file: ${filename}`);
        };
        fs.promises
            .stat(filename)
            .then((stat) => {
                if (stat.size > FileStore.SIZE_LIMIT) {
                    fs.promises
                        .unlink(filename)
                        .then(() => {
                            bind();
                        })
                        .catch((err: Error) => {
                            logger.error(`fail to drop file store (${filename}): ${err.message}`);
                        });
                } else {
                    bind();
                }
            })
            .catch((err: Error) => {
                logger.error(`fail to bind store (${filename}): ${err.message}`);
            });
    }

    public write(content: string) {
        if (this.stream === undefined) {
            this.pending += `${content}\n`;
            return;
        }
        if (this.pending !== '') {
            this.stream.write(this.pending);
            this.pending = '';
        }
        this.stream.write(`${content}\n`);
    }

    public unbind(): Promise<void> {
        if (this.stream === undefined) {
            return Promise.resolve();
        }
        this.stream.write(`Logs store is shutdown\n`);
        return this.stream.destroy();
    }
}
