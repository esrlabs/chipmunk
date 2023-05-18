import { Logger as Base, Level, state } from 'platform/log';
import { scope } from 'platform/env/scope';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const LOG_FILE = 'chipmunk.indexer.log';
const HOME = '.chipmunk';
const FORCED_REPORT_TIMEOUT = 2 * 60 * 1000;

const BLOCKS_LOGS = ((): boolean => {
    const value = (process.env as any)['JASMIN_TEST_BLOCKS_LOGS'];
    if (typeof value === 'string') {
        return ['true', 'on', '1'].includes(value.toLowerCase());
    } else if (typeof value === 'number') {
        return value > 0;
    } else if (typeof value === 'boolean') {
        return value;
    } else {
        return false;
    }
})();
export function getLogger(signature: string): Logger {
    return new Logger(signature);
}

const collected: string[] = [];
let inited: boolean = false;
let reported: boolean = false;
let timeout = setTimeout(() => {
    Logger.report();
}, FORCED_REPORT_TIMEOUT);

export class Logger extends Base {
    public static report() {
        if (reported) {
            return;
        }
        reported = true;
        const border = '='.repeat(75);
        console.log(`\n${border}\nNodeJS Level Logs\n${border}`);
        collected.forEach((log) => {
            console.log(log);
        });
        const filename = path.join(os.homedir(), HOME, LOG_FILE);
        console.log(`\n${border}\n${filename}\n${border}`);
        if (!fs.statSync(filename)) {
            console.log(`file isn't found`);
            return;
        }
        try {
            console.log(fs.readFileSync(filename, 'utf8'));
        } catch (e) {
            console.error(e);
        }
    }

    public override store(msg: string, _level: Level): void {
        // For testing we are writing all logs.
        collected.push(msg);
    }
}

export function initLogger() {
    if (inited) {
        return;
    }
    inited = true;
    scope.setLogger(Logger);
    state.setLevel(Level.ERROR);
}

initLogger();

let failed: number = 0;
const jasmineLogger = getLogger(`Jasmine`);

jasmine.getEnv().addReporter({
    specStarted: (result: any) => {
        jasmineLogger.debug(
            'Spec started: ' +
                result.description +
                ' whose full description is: ' +
                result.fullName,
        );
    },
    specDone: function (result: any) {
        if (result.status === 'passed') {
            return;
        }
        failed += 1;
    },
    suiteDone: function (_result: any) {
        if (failed === 0) {
            return;
        }
        clearTimeout(timeout);
        !BLOCKS_LOGS && Logger.report();
    },
});
