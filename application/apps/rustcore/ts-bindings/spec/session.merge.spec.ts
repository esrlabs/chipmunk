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

describe('Merge', function () {
    it('Test 1. Merge files', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Merge. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        const tmpobj = createSampleFile(
            5,
            logger,
            (i: number) => `2021 12 0${i + 1} 13:13:0${i} a--${i}\n`,
        );
        const tmpobj2 = createSampleFile(
            5,
            logger,
            (i: number) => `2021 12 0${i + 1} 13:13:0${i} b--${i}\n`,
        );
        stream
            .merge(
                [
                    {
                        path: tmpobj.name,
                        tag: tmpobj.name,
                        format: `YYYY MM DD hh:mm:ss`,
                        offset: 0,
                    },
                    {
                        path: tmpobj2.name,
                        tag: tmpobj2.name,
                        format: `YYYY MM DD hh:mm:ss`,
                        offset: 0,
                    },
                ],
                true,
            )
            .then(() => {
                let result: IGrabbedElement[] | Error = stream.grab(0, 10);
                if (result instanceof Error) {
                    finish(new Error(`Fail to grab data due error: ${result.message}`));
                    return;
                }
                logger.debug(
                    'result of grab was:\n' +
                        result
                            .map((row) => {
                                return row.content;
                            })
                            .join('\n'),
                );
                expect(result.map((i) => i.content.slice(20, 24))).toEqual([
                    `a--0`,
                    `b--0`,
                    `a--1`,
                    `b--1`,
                    `a--2`,
                    `b--2`,
                    `a--3`,
                    `b--3`,
                    `a--4`,
                    `b--4`,
                ]);
                finish();
            })
            .catch(finish);
    });
});
