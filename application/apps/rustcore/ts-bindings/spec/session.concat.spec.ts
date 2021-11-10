// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Concat', function () {
    it('Test 1. Concat files', function (done) {
        const logger = getLogger('Concat. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(session, done, stream);
            return;
        }
        const tmpobj = createSampleFile(5, logger, (i: number) => `a--${i}\n`);
        const tmpobj2 = createSampleFile(5, logger, (i: number) => `b--${i}\n`);
        stream
            .concat(
                [
                    {
                        path: tmpobj.name,
                        tag: tmpobj.name,
                    },
                    {
                        path: tmpobj2.name,
                        tag: tmpobj2.name,
                    },
                ],
                true,
            )
            .then(() => {
                let result: IGrabbedElement[] | Error = stream.grab(3, 5);
                if (result instanceof Error) {
                    finish(
                        session,
                        done,
                        new Error(`Fail to grab data due error: ${result.message}`),
                    );
                    return;
                }
                logger.debug('result of grab was: ' + JSON.stringify(result));
                expect(result.map((i) => i.content.slice(0, 4))).toEqual([
                    'a--3',
                    'a--4',
                    'b--0',
                    'b--1',
                    'b--2',
                ]);
                finish(session, done);
            })
            .catch(finish.bind(null, session, done));
    });
});
