// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { GrabbedElement } from 'platform/types/bindings';
import { createSampleFile, finish } from './common';
import { readConfigurationFile } from './config';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.ranges;

function sum(from: number, to: number): number {
    let s = 0;
    for (let i = from; i <= to; i += 1) {
        s += i;
    }
    return s;
}

describe('Grab ranges', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            const tmpobj = createSampleFile(1000, logger, (i: number) => `${i}\n`);
            comps.stream
                .observe(
                    new Factory.File()
                        .asText()
                        .type(Factory.FileType.Text)
                        .file(tmpobj.name)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let grabbing: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows === 0 || grabbing) {
                    return;
                }
                grabbing = true;
                Promise.all([
                    comps.stream
                        .grabRanges([{ start: 0, end: 99 }])
                        .then((result: GrabbedElement[]) => {
                            logger.debug('result of grab was: ' + JSON.stringify(result));
                            expect(
                                result
                                    .map((v) => parseInt(v.content, 10))
                                    .reduce((partialSum, a) => partialSum + a, 0),
                            ).toEqual(sum(0, 99));
                        }),
                    comps.stream
                        .grabRanges([
                            { start: 0, end: 0 },
                            { start: 10, end: 10 },
                        ])
                        .then((result: GrabbedElement[]) => {
                            logger.debug('result of grab was: ' + JSON.stringify(result));
                            expect(result.length).toEqual(2);
                            expect(parseInt(result[0].content, 10)).toEqual(0);
                            expect(parseInt(result[1].content, 10)).toEqual(10);
                        }),
                    comps.stream
                        .grabRanges([
                            { start: 0, end: 10 },
                            { start: 99, end: 200 },
                            { start: 299, end: 300 },
                            { start: 599, end: 600 },
                        ])
                        .then((result: GrabbedElement[]) => {
                            logger.debug('result of grab was: ' + JSON.stringify(result));
                            expect(
                                result
                                    .map((v) => parseInt(v.content, 10))
                                    .reduce((partialSum, a) => partialSum + a, 0),
                            ).toEqual(sum(0, 10) + sum(99, 200) + sum(299, 300) + sum(599, 600));
                        }),
                ])
                    .then(() => {
                        finish(comps.session, done);
                    })
                    .catch((err: Error) => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Fail to grab data due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            ),
                        );
                    });
            });
        });
    });
});
