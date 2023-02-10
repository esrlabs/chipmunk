// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { setLogLevels, lockChangingLogLevel, Logger } from '../src/util/logging';
import * as tmp from 'tmp';
import * as fs from 'fs';

const NS_PER_SEC = 1e9;
const NS_PER_MS = 1000000;
const MS_PER_SEC = 1000;

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

export function finish(session: Session | undefined, done: () => void, err?: Error): void {
    err !== undefined && fail(err);
    if (session !== undefined) {
        session
            .destroy()
            .catch((error: Error) => {
                fail(error);
            })
            .finally(() => {
                checkSessionDebugger(session, done);
            });
    } else {
        done();
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
    let loglevel = (process.env as any)['JASMIN_LOG_LEVEL'];
    loglevel = loglevel === undefined ? 1 : parseInt(loglevel, 10);
    if (isNaN(loglevel) || !isFinite(loglevel) || loglevel < 0 || loglevel > 6) {
        return;
    }
    setLogLevels(loglevel);
    lockChangingLogLevel('Jasmin Tests');
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
