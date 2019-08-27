import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const LOG_FILE = path.resolve(os.homedir(), '.logviewer/logviewer.updater.log');

export function log(msg: string) {
    fs.appendFile(LOG_FILE, `${msg}\n`, { encoding: 'utf8' }, (error: NodeJS.ErrnoException | null) => {
        if (error) {
            // tslint:disable-next-line:no-console
            console.error(`Fail to write logs into file due error: ${error.message}`);
        }
    });
}
