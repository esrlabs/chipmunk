import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME = '.chipmunk';
const LOG_FILE = 'chipmunk.log';
/**
 * This logger is used only during loading application before initialization
 * of services
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

    public write(msg: string): void {
        fs.appendFileSync(this.file, `[INIT][${new Date().toUTCString()}]: ${msg}\n`);
    }
}

export const logger = new InitialLogger();
