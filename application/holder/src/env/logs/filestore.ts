import { StreamController } from '../fs/stream';
import { scope } from 'platform/env/scope';

import * as fs from 'fs';

export class FileStore {
    static SIZE_LIMIT = 1024 * 1024 * 10;

    protected pending = '';
    protected stream: StreamController | undefined;

    public async bind(filename: string): Promise<void> {
        const logger = scope.getLogger('LogFileStore');
        const bind = () => {
            this.stream = new StreamController(filename).init();
            logger.debug(`bound with file: ${filename}`);
        };
        if (!fs.existsSync(filename)) {
            await fs.promises.writeFile(filename, '');
        }
        const stat = await fs.promises.stat(filename);
        if (stat.size > FileStore.SIZE_LIMIT) {
            await fs.promises.unlink(filename);
        }
        bind();
        return Promise.resolve();
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
        const stream = this.stream;
        this.stream = undefined;
        stream.write(`Logs store is shutdown\n`);
        return stream.destroy().catch((err: Error) => {
            console.error(`Fail to destroy logs store: ${err.message}`);
        });
    }
}
