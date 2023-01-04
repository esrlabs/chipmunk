import { SetupLogger, LoggerInterface } from 'platform/entity/logger';

import * as fs from 'fs';
import * as path from 'path';

@SetupLogger()
export class StreamController {
    public readonly filename: string;
    protected stream: fs.WriteStream;
    protected closed = false;
    protected error: Error | undefined;

    constructor(filename: string) {
        this.filename = filename;
        if (!fs.existsSync(filename)) {
            fs.writeFileSync(filename, '');
        }
        this.stream = fs.createWriteStream(filename, { flags: 'a', encoding: 'utf-8' });
    }

    public init(): StreamController {
        this.setLoggerName(`Stream ("${path.basename(this.filename)}")`);
        return this;
    }

    public destroy(): Promise<void> {
        if (this.closed) {
            return Promise.resolve();
        }
        this.closed = true;
        return new Promise((resolve) => {
            this.stream.end(() => {
                this.stream.destroy();
                resolve();
            });
        });
    }

    public write(content: string): void {
        if (this.closed || this.error !== undefined) {
            return;
        }
        this.stream.write(content, (error: Error | null | undefined) => {
            if (this.error instanceof Error) {
                return;
            }
            if (error instanceof Error) {
                this.error = error;
            }
        });
    }
}
export interface StreamController extends LoggerInterface {}
