// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { checkSessionDebugger, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Concat', function () {
    it('Test 1. Concat files', function (done) {
        const logger = getLogger('Concat. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        const tmpobj = createSampleFile(5, logger, (i: number) => `a--${i}\n`);
        const tmpobj2 = createSampleFile(5, logger, (i: number) => `b--${i}\n`);
        const tmpconf = tmp.fileSync();
        const confContent = `[
        {
            "path": "${tmpobj.name}",
            "offset": 0,
            "format": "MM-DD hh:mm:ss.s TZD",
            "tag": "A-TAG",
            "year": 2019
        },
        {
            "path": "${tmpobj2.name}",
            "offset": 0,
            "tag": "B-TAG",
            "format": "MM-DD hh:mm:ss.s TZD",
            "year": 2019
        }
        ]`;
        const tmpout = tmp.fileSync();
        fs.appendFileSync(tmpconf.name, confContent);
        stream
            .concat(tmpconf.name, tmpout.name, true)
            .then(() => {
                // While we do not have operation id
                logger.warn("Then happpppppened...");
                let result: IGrabbedElement[] | Error = stream.grab(3, 5);
                if (result instanceof Error) {
                    fail(`Fail to grab data due error: ${result.message}`);
                    return done();
                }
                logger.debug('result of grab was: ' + JSON.stringify(result));
                expect(result.map((i) => i.content.slice(0, 4))).toEqual([
                    'a--3',
                    'a--4',
                    'b--0',
                    'b--1',
                    'b--2',
                ]);
                checkSessionDebugger(session);
                done();
            })
            .catch((err: Error) => {
                logger.warn("Error happpppppened..." + err);
                fail(err);
                done();
            })
            .finally(() => {
                logger.warn("concat test over...session.destroy");
                session.destroy();
            });
    });
});
