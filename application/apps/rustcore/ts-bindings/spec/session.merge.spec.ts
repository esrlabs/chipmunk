// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Merge', function () {
    it('Test 1. Merge files', function (done) {
        const logger = getLogger('Merge. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true, 'Test 1. Merge files');
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(session, done, stream);
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
                stream
                    .grab(0, 10)
                    .then((result: IGrabbedElement[]) => {
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
                        finish(session, done);
                    })
                    .catch((err: Error) => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Fail to grab data due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            ),
                        );
                    });
            })
            .catch(finish.bind(null, session, done));
    });
});
