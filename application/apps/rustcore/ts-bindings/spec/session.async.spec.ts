// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { checkSessionDebugger, isAsyncResearchTest } from './common';

function title(title: string) {
    console.log(`${'\n'.repeat(2)}${'='.repeat(60)}`);
    console.log(`TEST: ${title}`);
    console.log(`${'='.repeat(60)}`);

}

const COUNT: number = 10;   // count of background operations on JS level
const SLEEP: number = 3000; // duration of rust sleeping, ms

const TEST_LOG_FILE: string | undefined = (() => {
    const envValue = (process.env as any)['TEXT_LOG_FILE_FOR_JASMIN'];
    if (typeof envValue === 'string' && envValue.trim() !== '') {
        return envValue.trim();
    } else {
        return undefined;
    }
})();

isAsyncResearchTest() && describe('Sync & Async rust calls', function () {

    if (TEST_LOG_FILE === undefined) {
        console.log(`${'='.repeat(60)}`);
        console.log(`WARNING!`);
        console.log(`${'='.repeat(60)}`);
        console.log(`To start assign test please define a path to some huge log file using`);
        console.log(`export TEXT_LOG_FILE_FOR_JASMIN=path_to_file`);
        console.log(`${'='.repeat(60)}`);
    } else {
        it('Assign file', function (done) {
            const finish = () => {
                if (threads.sub.done === -1) {
                    return;
                }
                if (index < COUNT) {
                    return;
                }
                checkSessionDebugger(session);
                console.log(`[JS] Sub done in: ${threads.sub.done} ms.`);
                done();
            };
            title(`Assign file`);
            const session = new Session();
            // Set provider into debug mode
            session.debug(true);
            const threads: {
                main: { start: number, done: number },
                sub: { start: number, done: number },
            } = {
                main: { start: Date.now(), done: -1 },
                sub: { start: Date.now(), done: -1 },
            };
            console.log(`[JS] Main thread started`);
            console.log(`[JS] Sub thread started`);
            session.assignSync(TEST_LOG_FILE).then(() => {
            }).catch((err: Error) => {
                fail(
                    new Error(
                        `Operation is rejected, but should be canceled. Error: ${err.message}`,
                    ),
                );
            }).finally(() => {
                console.log(`[JS] Sub thread done`);
                session.destroy();
                threads.sub.done = Date.now() - threads.sub.start;
                finish();
            });
            console.log(`[JS] Main thread exit`);
            threads.main.done = Date.now() - threads.main.start;
            console.log(`[JS] Main done in: ${threads.main.done} ms.`);
            let index: number = 0;
            for (let i = COUNT; i >= 0; i -= 1) {
                setTimeout(() => {
                    index += 1;
                    console.log(`[JS]: doing some parallel work ${index}`);
                    finish();
                }, 50);
            }
        });
    }
    it('sleepSync', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < COUNT) {
                return;
            }
            checkSessionDebugger(session);
            done();
        };
        title(`sleepSync`);
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`[JS] Main thread started`);
        setTimeout(() => {
            console.log(`[JS] Sub thread started`);
            threads.sub.start = Date.now();
            session.getNativeSession().sleepSync(SLEEP);
            threads.sub.done = Date.now();
            console.log(`[JS] Sub thread exit`);
            finish();
        }, 0);
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = COUNT; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`[JS]: doing some parallel work ${index}`);
                finish();
            }, 50);
        }
        console.log(`[JS] Main thread exit`);
        finish();
    });

    it('sleepThread', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < COUNT) {
                return;
            }
            checkSessionDebugger(session);
            done();
        };
        title(`sleepThread`);
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`[JS] Main thread started`);
        setTimeout(() => {
            console.log(`[JS] Sub thread started`);
            threads.sub.start = Date.now();
            session.getNativeSession().sleepThread(SLEEP);
            threads.sub.done = Date.now();
            console.log(`[JS] Sub thread exit`);
            finish();
        }, 0);
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = COUNT; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`[JS]: doing some parallel work ${index}`);
                finish();
            }, 50);
        }
        console.log(`[JS] Main thread exit`);
        finish();
    });

    it('sleepLoop: not busy', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < COUNT) {
                return;
            }
            checkSessionDebugger(session);
            console.log(`Done in: ${threads.sub.done} ms. Expectation: ${SLEEP}. Diff: ${threads.sub.done - SLEEP}`);
            done();
        };
        title(`sleepLoop: not busy`);
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`[JS] Main thread started`);
        threads.sub.start = Date.now();
        session.sleepLoop(SLEEP, false).then(() => {
            threads.sub.done = Date.now() - threads.sub.start;
            console.log(`[JS] resolved`);
            finish();
        }).catch((err: Error) => {
            console.log(`[JS] rejected: ${err.message}`);
            fail(err);
            done();
        });
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = COUNT; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`[JS]: doing some parallel work ${index}`);
                finish();
            }, 50);
        }
        console.log(`[JS] Main thread exit`);
        finish();
    });

    it('sleepLoop: busy', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < COUNT) {
                return;
            }
            checkSessionDebugger(session);
            console.log(`Done in: ${threads.sub.done} ms. Expectation: ${SLEEP}. Diff: ${threads.sub.done - SLEEP}`);
            done();
        };
        title(`sleepLoop: busy`);
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`[JS] Main thread started`);
        threads.sub.start = Date.now();
        session.sleepLoop(SLEEP, true).then(() => {
            threads.sub.done = Date.now() - threads.sub.start;
            console.log(`[JS] resolved`);
            finish();
        }).catch((err: Error) => {
            console.log(`[JS] rejected: ${err.message}`);
            fail(err);
            done();
        });
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = COUNT; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`[JS]: doing some parallel work ${index}`);
                finish();
            }, 50);
        }
        console.log(`[JS] Main thread exit`);
        finish();
    });

    it('sleepAsync: resolve', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < COUNT) {
                return;
            }
            checkSessionDebugger(session);
            setTimeout(() => {
                // Wait for rust a bit more
                done();
            }, SLEEP / 2);
        };
        title(`sleepAsync: resolve`);
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`[JS] Main thread started`);
        session.getNativeSession().sleepAsync(SLEEP, false).then((m) => {
            threads.sub.start = Date.now();
            threads.sub.done = Date.now();
            console.log(`[JS]: resolved ${m}`);
            finish();
        }).catch((err: Error) => {
            console.log(`[JS]: rejected ${err.message}`);
            fail(err);
            done();
        });
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = COUNT; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`[JS]: doing some parallel work ${index}`);
                finish();
            }, 50);
        }
        console.log(`[JS] Main thread exit`);
        finish();
    });

    it('sleepAsync: reject', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < COUNT) {
                return;
            }
            checkSessionDebugger(session);
            setTimeout(() => {
                // Wait for rust a bit more
                done();
            }, SLEEP / 2);
        };
        title(`sleepAsync: rejecting`);
        const COUNT: number = 10;
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`[JS] Main thread started`);
        session.getNativeSession().sleepAsync(SLEEP, true).then((m) => {
            console.log(`[JS]: resolved ${m}`);
            fail(new Error(`sleepAsync should be rejected, but it's resolved`));
            done();
        }).catch((err: Error) => {
            threads.sub.start = Date.now();
            threads.sub.done = Date.now();
            console.log(`[JS]: rejected`);
            finish();
        });
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = COUNT; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`[JS]: doing some parallel work ${index}`);
                finish();
            }, 50);
        }
        console.log(`[JS] Main thread exit`);
        finish();
    });

});
