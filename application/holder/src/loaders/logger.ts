import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME = '.chipmunk';
const LOG_FILE = 'chipmunk.log';

/**
 * This logger is used only during loading application before initialization
 * of services.
 * This logger can be used ONLY in ./loaders/cli.ts
 */
class InitialLogger {
    protected file: string;

    constructor() {
        const home = path.join(os.homedir(), HOME);
        this.file = path.join(home, LOG_FILE);
        if (!fs.existsSync(home)) {
            fs.mkdirSync(home);
        }
        if (!fs.existsSync(this.file)) {
            fs.writeFileSync(this.file, '');
        }
        this.write(`\n${'-'.repeat(75)}\nsession: ${new Date().toUTCString()}\n${'-'.repeat(75)}`);
    }

    public write(msg: string, error?: Error): void {
        const errorMsg = (() => {
            if (error instanceof Error) {
                return `${error.name}: ${error.message}${
                    error.cause !== undefined ? `\n${error.cause}` : ''
                }${error.stack !== undefined ? `\n${error.stack}` : ''}`;
            } else {
                return undefined;
            }
        })();
        fs.appendFileSync(
            this.file,
            `[INIT][${new Date().toUTCString()}]: ${msg}\n${
                errorMsg === undefined ? '' : `${errorMsg}\n`
            }`,
        );
    }
}

process.on('uncaughtException', (error: Error) => {
    logger.write(`[CRITICAL] uncaughtException`, error);
});

process.on('unhandledRejection', (error: Error) => {
    logger.write(`[CRITICAL] unhandledRejection`, error);
});

export const logger = new InitialLogger();
