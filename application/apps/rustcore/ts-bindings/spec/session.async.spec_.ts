// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { checkSessionDebugger } from './common';
import { getNativeModule } from '../src/native/native';
// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;
describe('Async', function () {
    // it('Blocked: checking blocking JS thread', function (done) {
    //     const finish = () => {
    //         if (threads.sub.done === -1) {
    //             return;
    //         }
    //         if (index < 100) {
    //             return;
    //         }
    //         checkSessionDebugger(session);
    //         done();
    //     };
    //     console.log(`>>>>>> Blocked test`);
    //     const session = new Session();
    //     // Set provider into debug mode
    //     session.debug(true);
    //     const threads: {
    //         main: { start: number, done: number },
    //         sub: { start: number, done: number },
    //     } = {
    //         main: { start: Date.now(), done: -1 },
    //         sub: { start: -1, done: -1 },
    //     };
    //     console.log(`>>>>>>>> Main thread started`);
    //     setTimeout(() => {
    //         threads.sub.start = Date.now();
    //         session.getNativeSession().sleep(8000);
    //         threads.sub.done = Date.now();
    //         console.log(`>>>>>>>> Sub thread exit`);
    //         finish();
    //     }, 0);
    //     threads.main.done = Date.now();
    //     let index: number = 0;
    //     for (let i = 100; i >= 0; i -= 1) {
    //         setTimeout(() => {
    //             index += 1;
    //             console.log(`>>>>>>>> Parallel thread counting: ${index}`);
    //             finish();
    //         }, 50);
    //     }
    //     console.log(`>>>>>>>> Main thread exit`);
    //     finish();
    // });

    it('Unblocked: checking blocking JS thread', function (done) {
        const finish = () => {
            if (threads.sub.done === -1) {
                return;
            }
            if (index < 100) {
                return;
            }
            checkSessionDebugger(session);
            setTimeout(() => {
                // Wait for rust
                done();
            }, duration);
        };
        const session = new Session();
        const duration: number = 8000;
        // Set provider into debug mode
        session.debug(true);
        const threads: {
            main: { start: number, done: number },
            sub: { start: number, done: number },
        } = {
            main: { start: Date.now(), done: -1 },
            sub: { start: -1, done: -1 },
        };
        console.log(`>>>>>>>> Main thread started`);
        session.getNativeSession().sleepUnblock(duration).then((m) => {
            threads.sub.start = Date.now();
            threads.sub.done = Date.now();
            console.log(`>>>>>>>> Sub(rust) thread exit: ${m}`);
            finish();
        }).catch((err: Error) => {
            console.log(err);
            console.log(`>>>>>>>> Sub(rust) paniced: ${err.message}`);
            done();
        });
        threads.main.done = Date.now();
        let index: number = 0;
        for (let i = 100; i >= 0; i -= 1) {
            setTimeout(() => {
                index += 1;
                console.log(`>>>>>>>> Parallel thread counting: ${index}`);
                finish();
            }, 50);
        }
        console.log(`>>>>>>>> Main thread exit`);
        finish();
    });

});
