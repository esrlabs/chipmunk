// tslint:disable

import { Jobs, Tracker, Session, Components } from '../src/index';
import { Logger } from './logger';
import { error, numToLogLevel } from 'platform/log/utils';
import { state } from 'platform/log';

import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

const NS_PER_SEC = 1e9;
const NS_PER_MS = 1000000;
const MS_PER_SEC = 1000;

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

export function rootPath(): string {
    const parts = path.dirname(module.filename).split(path.sep);
    if (parts.length > 0 && parts[0].trim() === '') {
        parts[0] = path.sep;
    }
    for (let i = parts.length - 1; i >= 0; i -= 1) {
        const el = parts[i];
        parts.splice(i, 1);
        if (el === 'application') {
            break;
        }
    }
    return path.join(...parts);
}
export function relativePath(dest: string): string {
    return path.join(rootPath(), dest);
}

export function readConfigFile<T>(filenameEnvVar: string, defaultPaths: string[]): T | Error {
    const defaults = (() => {
        for (const target of defaultPaths) {
            if (fs.existsSync(target)) {
                return target;
            }
        }
        return undefined;
    })();

    let filename = (process.env as any)[filenameEnvVar];
    if ((typeof filename !== 'string' || filename.trim() === '') && defaults === undefined) {
        return new Error(
            `To run test you should define a path to configuration file with ${filenameEnvVar}=path_to_config_json_file`,
        );
    } else if (typeof filename !== 'string' || filename.trim() === '') {
        filename = defaults;
    }

    if (!fs.existsSync(filename)) {
        return new Error(`Configuration file ${filename} doesn't exist`);
    }

    const buffer = fs.readFileSync(filename);
    try {
        return JSON.parse(buffer.toString().replace(/\/\*.*\*\//gi, '')) as T;
    } catch (err) {
        return new Error(
            `Fail to parse configuration file ${filename}; error: ${
                err instanceof Error ? err.message : err
            }`,
        );
    }
}

export function finish(
    sessions:
        | Array<Session | Jobs | Tracker | Components | undefined>
        | Session
        | Jobs
        | Tracker
        | Components
        | undefined,
    done: (...args: any[]) => void,
    err?: Error,
): void {
    if (err !== undefined) {
        fail(err);
    }
    sessions = sessions instanceof Array ? sessions : [sessions];
    const filtered = sessions.filter((s) => s !== undefined);
    if (filtered.length === 0) {
        done();
    } else {
        Promise.allSettled(
            filtered.map((session) =>
                session === undefined ? Promise.resolve() : session.destroy(),
            ),
        ).then((results) => {
            let reasons: any[] = [];
            results.forEach((res) => {
                if (res.status === 'rejected') {
                    reasons.push(res.reason);
                }
            });
            if (reasons.length === 0) {
                const session = filtered.find((s) => s instanceof Session);
                if (session !== undefined) {
                    checkSessionDebugger(session as Session, done);
                } else {
                    done();
                }
            } else {
                fail(new Error(reasons.map((r) => error(r)).join('; ')));
            }
        });
    }
}

export function checkSessionDebugger(session: Session, done: () => void) {
    const stat = session.getDebugStat();
    if (stat.unsupported.length !== 0) {
        fail(new Error(`Unsupported events:\n\t- ${stat.unsupported.join('\n\t- ')}`));
    }
    if (stat.errors.length !== 0) {
        fail(new Error(`Errors:\n\t- ${stat.errors.join('\n\t- ')}`));
    }
    session.printDebugStat(true);
    done();
}

(function () {
    const loglevel: string | undefined = (process.env as any)['JASMIN_LOG_LEVEL'];
    const numericLoglevel: number = loglevel === undefined ? 1 : parseInt(loglevel, 10);
    if (
        isNaN(numericLoglevel) ||
        !isFinite(numericLoglevel) ||
        numericLoglevel < 0 ||
        numericLoglevel > 6
    ) {
        return;
    }
    state.setLevel(numToLogLevel(numericLoglevel));
})();

export function createSampleFile(
    lines: number,
    logger: Logger,
    creator: (i: number) => string,
): tmp.FileResult {
    const tmpobj = tmp.fileSync();
    var content = '';
    for (let i = 0; i < lines; i++) {
        content += creator(i);
    }
    fs.appendFileSync(tmpobj.name, content);
    const stats = fs.statSync(tmpobj.name);
    logger.debug(`Created example grabber file of size: ${stats.size}`);
    return tmpobj;
}

export function appendToSampleFile(
    tmpobj: tmp.FileResult,
    lines: number,
    logger: Logger,
    creator: (i: number) => string,
): tmp.FileResult {
    var content = '';
    for (let i = 0; i < lines; i++) {
        content += creator(i);
    }
    fs.appendFileSync(tmpobj.name, content);
    const stats = fs.statSync(tmpobj.name);
    logger.debug(`Appened date to example file of size: ${stats.size}`);
    return tmpobj;
}

export function performanceReport(
    name: string,
    actual: number,
    expectation: number,
    filename?: string,
): boolean {
    const output = console.log;
    const LEN: number = 80;
    const MAX = LEN + 2;
    const SCALE = 10;
    const format = (str: string, filler: string = ' '): string => {
        return `│ ${str}${filler.repeat(MAX > str.length - 3 ? MAX - str.length - 3 : 0)}│`;
    };
    const fill = (str: string, len: number, filler: string = ' '): string => {
        if (len - str.length < 0) {
            return str;
        }
        return `${filler.repeat(len - str.length)}${str}`;
    };
    output(`\n┌${'─'.repeat(LEN)}┐`);
    output(format(`▒▒▒ ${name} `, '▒'));
    output(format(`Performance measurement: ${actual < expectation ? 'PASSED' : 'FAILED'}`));
    if (typeof filename === 'string') {
        const stat = fs.statSync(filename);
        output(format(`File size: ${(stat.size / 1024 / 1024).toFixed(2)}Mb`));
    }
    output(`├${'─'.repeat(LEN)}┤`);
    const step = Math.max(expectation, actual) / SCALE;
    const scale_actual = Math.floor(actual / step);
    const scale_expect = Math.floor(expectation / step);
    const diff = Math.abs(expectation - actual);
    const scale_diff = Math.floor(diff / step);
    output(
        format(
            `${fill('Actual', 14)} [${fill(actual.toFixed(2), 8)}ms][${'■'.repeat(
                scale_actual,
            )}${'·'.repeat(SCALE - scale_actual < 0 ? 0 : SCALE - scale_actual)}]`,
        ),
    );
    output(
        format(
            `${fill('Expectation', 14)} [${fill(expectation.toFixed(2), 8)}ms][${'■'.repeat(
                scale_expect,
            )}${'·'.repeat(SCALE - scale_expect < 0 ? 0 : SCALE - scale_expect)}]`,
        ),
    );
    output(
        format(
            `${fill('Diff', 14)} [${fill(diff.toFixed(2), 8)}ms][${'■'.repeat(
                scale_diff,
            )}${'·'.repeat(SCALE - scale_diff < 0 ? 0 : SCALE - scale_diff)}]`,
        ),
    );
    output(`└${'─'.repeat(LEN)}┘`);

    const result = {
        name,
        actual,
        expectation,
        passed: actual <= expectation,
    };

    let performance_results_folder = (process.env as any)['PERFORMANCE_RESULTS_FOLDER'];
    let performance_results = (process.env as any)['PERFORMANCE_RESULTS'];
    let home_dir = (process.env as any)['SH_HOME_DIR'];
    if (home_dir && performance_results_folder) {
        const folderPath = path.join(home_dir, performance_results_folder);
        const filePath = path.join(folderPath, performance_results);
        // Ensure filePath is a real path
        if (!fs.existsSync(folderPath)) {
            // Create directory if it doesn't exist
            fs.mkdirSync(folderPath, { recursive: true });
            output(`Created directory: ${folderPath}`);
        }

        let results = [];
        if (fs.existsSync(filePath)) {
            let existingData = fs.readFileSync(filePath, 'utf-8');
            try {
                results = JSON.parse(existingData);
            } catch (error) {
                output('Error parsing existing JSON data:');
            }
        }
        results.push(result);
        const data = JSON.stringify(results, null, 2); // JSON format with indentation
        fs.writeFileSync(filePath, data);
    } else {
        output(`Missing necessary environment variables for file path.`);
    }

    return actual <= expectation;
}

export interface ITimeMeasurement {
    ns: number;
    ms: number;
    ms_str: string;
    sec_str: string;
}
export function setMeasurement(): () => ITimeMeasurement {
    const start = process.hrtime();
    return (): ITimeMeasurement => {
        const end = process.hrtime(start);
        const ns = end[0] * NS_PER_SEC + end[1];
        const ms = ns / NS_PER_MS;
        return {
            ns: ns,
            ms: ms,
            ms_str: ms.toFixed(2),
            sec_str: (ms / MS_PER_SEC).toFixed(2),
        };
    };
}
