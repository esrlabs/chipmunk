// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish, performanceReport, setMeasurement } from './common';
import { getLogger } from '../src/util/logging';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.indexes;

function ignore(id: string | number, done: () => void) {
    if (
        config.regular.execute_only.length > 0 &&
        config.regular.execute_only.indexOf(typeof id === 'number' ? id : parseInt(id, 10)) === -1
    ) {
        console.log(`"${config.regular.list[id]}" is ignored`);
        done();
        return true;
    } else {
        return false;
    }
}

describe('Indexes', function () {
    it(config.regular.list[1], function (done) {
        const testName = config.regular.list[1];
        if (ignore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        (async () => {
            try {
                const session = await Session.create();
                // Set provider into debug mode
                session.debug(true, testName);
                const stream = session.getStream();
                if (stream instanceof Error) {
                    finish(session, done, stream);
                    return;
                }
                const search = session.getSearch();
                if (search instanceof Error) {
                    finish(session, done, search);
                    return;
                }
                const events = session.getEvents();
                if (events instanceof Error) {
                    finish(session, done, events);
                    return;
                }
                let controlSum = 0;
                let countMatches = 0;
                const tmpobj = createSampleFile(100, logger, (i: number) => {
                    controlSum += i % 5 == 0 ? i : 0;
                    countMatches += i % 5 == 0 ? 1 : 0;
                    return `${i}: some line data: ${i % 5 == 0 ? `match A` : ''}\n`;
                });
                let read: boolean = false;
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .catch(finish.bind(null, session, done));
                events.StreamUpdated.subscribe(async (rows: number) => {
                    if (rows < 100 || read) {
                        return;
                    }
                    read = true;
                    try {
                        await search.search([
                            {
                                filter: 'match A',
                                flags: { reg: true, word: true, cases: false },
                            },
                        ]);
                        let items = await stream.grabIndexed(0, countMatches);
                        expect(items.length).toEqual(countMatches);
                        expect(
                            items
                                .map((item) =>
                                    parseInt(
                                        (item.content.match(/\d*/) as unknown as string)[0],
                                        10,
                                    ),
                                )
                                .reduce((partialSum, a) => partialSum + a, 0),
                        ).toEqual(controlSum);
                        // Set single index
                        await stream.setIndexes(1, [{ from: 2, to: 2 }]);
                        items = await stream.grabIndexed(0, 3);
                        expect(items.length).toEqual(3);
                        expect(items.map((i) => i.position).join(',')).toEqual([0, 2, 5].join(','));
                        // Remove index
                        await stream.unsetIndexes(1, [{ from: 2, to: 2 }]);
                        // Set multiple indexes
                        await stream.setIndexes(1, [
                            { from: 6, to: 9 },
                            { from: 11, to: 14 },
                        ]);
                        items = await stream.grabIndexed(0, 15);
                        expect(items.length).toEqual(15);
                        expect(items.map((i) => i.position).join(',')).toEqual(
                            [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30].join(','),
                        );
                        expect(
                            (
                                items.map((i) => {
                                    return i.nature.includes(1) ? 1 : 0;
                                }) as number[]
                            ).reduce((s, a) => s + a, 0),
                        ).toEqual(8);
                        // Remove multiple indexes
                        await stream.unsetIndexes(1, [
                            { from: 6, to: 9 },
                            { from: 11, to: 14 },
                        ]);
                        items = await stream.grabIndexed(0, 5);
                        expect(items.length).toEqual(5);
                        expect(items.map((i) => i.position).join(',')).toEqual(
                            [0, 5, 10, 15, 20].join(','),
                        );
                        expect(items.map((i) => i.position).join(',')).toEqual(
                            [0, 5, 10, 15, 20].join(','),
                        );
                        expect(items.map((i) => i.nature[0]).reduce((s, a) => s + a, 0)).toEqual(0);
                        finish(session, done);
                    } catch (err) {
                        finish(
                            undefined,
                            done,
                            new Error(
                                `Fail to finish test due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            ),
                        );
                    }
                });
                return Promise.resolve();
            } catch (err) {
                return Promise.reject(err instanceof Error ? err : new Error(`${err}`));
            }
        })().catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Fail to finish test due error: ${err instanceof Error ? err.message : err}`,
                ),
            );
        });

        // Session.create()
        //     .then((session: Session) => {
        //         // Set provider into debug mode
        //         session.debug(true, testName);
        //         const stream = session.getStream();
        //         if (stream instanceof Error) {
        //             finish(session, done, stream);
        //             return;
        //         }
        //         const events = session.getEvents();
        //         if (events instanceof Error) {
        //             finish(session, done, events);
        //             return;
        //         }
        //         const tmpobj = createSampleFile(
        //             5000,
        //             logger,
        //             (i: number) => `some line data: ${i}\n`,
        //         );
        //         stream
        //             .observe(Observe.DataSource.file(tmpobj.name).text())
        //             .catch(finish.bind(null, session, done));
        //         let grabbing: boolean = false;
        //         events.StreamUpdated.subscribe((rows: number) => {
        //             if (rows === 0 || grabbing) {
        //                 return;
        //             }
        //             grabbing = true;
        //             stream
        //                 .grab(500, 7)
        //                 .then((result: IGrabbedElement[]) => {
        //                     logger.debug('result of grab was: ' + JSON.stringify(result));
        //                     expect(result.map((i) => i.content)).toEqual([
        //                         'some line data: 500',
        //                         'some line data: 501',
        //                         'some line data: 502',
        //                         'some line data: 503',
        //                         'some line data: 504',
        //                         'some line data: 505',
        //                         'some line data: 506',
        //                     ]);
        //                     finish(session, done);
        //                 })
        //                 .catch((err: Error) => {
        //                     finish(
        //                         session,
        //                         done,
        //                         new Error(
        //                             `Fail to grab data due error: ${
        //                                 err instanceof Error ? err.message : err
        //                             }`,
        //                         ),
        //                     );
        //                 });
        //         });
        //     })
        //     .catch((err: Error) => {});
    });
});
