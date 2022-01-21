// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { setLogLevels, lockChangingLogLevel, Logger } from '../src/util/logging';
import * as tmp from 'tmp';
import * as fs from 'fs';

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

export function finish(session: Session | undefined, done: () => void, err?: Error): void {
    err !== undefined && fail(err);
    session !== undefined &&
        session
            .destroy()
            .catch((error: Error) => {
                fail(error);
            })
            .finally(() => {
                checkSessionDebugger(session, done);
            });
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

export function createSampleFile(lines: number, logger: Logger, creator: (i: number) => string) {
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
