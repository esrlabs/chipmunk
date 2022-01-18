// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish } from './common';
import { getLogger } from '../src/util/logging';

describe('Assign', function () {
    it('Test 1. Assign and grab content', function (done) {
        const logger = getLogger('Assign. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true, 'Assign. Test 1');
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(session, done, stream);
            return;
        }
        const events = session.getEvents();
        if (events instanceof Error) {
            finish(session, done, events);
            return;
        }
        const tmpobj = createSampleFile(5000, logger, (i: number) => `some line data: ${i}\n`);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                console.log('>>>>>>>>>>>> assigned');
            })
            .catch(finish.bind(null, session, done));
        events.StreamUpdated.subscribe((rows: number) => {
            console.log(`>>>>>>>>>>>> rows: ${rows}`);
            if (rows === 0) {
                return;
            }
            stream
                .grab(500, 7)
                .then((result: IGrabbedElement[]) => {
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
                    finish(session, done);
                })
                .catch((err: Error) => {
                    finish(session, done, new Error(`Fail to grab data due error: ${err.message}`));
                });
        });
    });
});
