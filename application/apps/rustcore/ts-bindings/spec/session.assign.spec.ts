// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { checkSessionDebugger } from './common';
import { getLogger } from '../src/util/logging';

describe('Assign', function () {
    it('Test 1. Assign and grab content', function (done) {
        const logger = getLogger('Assign. Test 1');
        function createSampleFile(lines: number) {
            const tmpobj = tmp.fileSync();
            logger.verbose(`Create example grabber file`);
            for (let i = 0; i < lines; i++) {
                fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
            }
            const stats = fs.statSync(tmpobj.name);
            logger.verbose(`file-size: ${stats.size}`);
            return tmpobj;
        }

        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        const tmpobj = createSampleFile(5000);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                // While we do not have operation id
                let result: IGrabbedElement[] | Error = stream.grab(500, 7);
                if (result instanceof Error) {
                    fail(`Fail to grab data due error: ${result.message}`);
                    return done();
                }
                logger.debug('result of grab was: ' + JSON.stringify(result));
                expect(result.map((i) => i.content)).toEqual([
                    'some line data: 500',
                    'some line data: 501',
                    'some line data: 502',
                    'some line data: 503',
                    'some line data: 504',
                    'some line data: 505',
                    'some line data: 506',
                ]);
                checkSessionDebugger(session);
                done();
            })
            .catch((err: Error) => {
                fail(err);
                done();
            })
            .finally(() => {
                session.destroy();
            });
    });
});
