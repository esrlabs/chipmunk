// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish, performanceReport, setMeasurement } from './common';
import { getLogger } from '../src/util/logging';
import { readConfigurationFile } from './config';
import { Nature, IndexingMode, NatureTypes } from 'platform/types/content';

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
                const tmpobj = createSampleFile(50, logger, (i: number) => {
                    controlSum += i % 10 == 0 ? i : 0;
                    countMatches += i % 10 == 0 ? 1 : 0;
                    return `${i}: some line data: ${i % 10 == 0 ? `match A` : ''}\n`;
                });
                let read: boolean = false;
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .catch(finish.bind(null, session, done));
                const updates: number[] = [];
                events.IndexedMapUpdated.subscribe((event) => {
                    event.len > 0 && updates.push(event.len);
                    console.log(`>>>>>>>>>>>>>>>>>>>>>> LEN: ${event.len}`);
                });
                events.StreamUpdated.subscribe(async (rows: number) => {
                    if (rows < 50 || read) {
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
                        expect(
                            items.map((i) => [i.position, new Nature(i.nature).getTypes()]),
                        ).toEqual([
                            [0, [NatureTypes.Search]],
                            [10, [NatureTypes.Search]],
                            [20, [NatureTypes.Search]],
                            [30, [NatureTypes.Search]],
                            [40, [NatureTypes.Search]],
                        ]);
                        await stream.setIndexingMode(IndexingMode.Breadcrumbs);
                        let len = await stream.getIndexedLen();
                        expect(len).toEqual(30);
                        items = await stream.grabIndexed(0, len);
                        items.forEach((i) => {
                            console.log(
                                `${i.position}: ${i.nature}: ${new Nature(i.nature)
                                    .getTypes()
                                    .join(',')}`,
                            );
                        });
                        expect(items.length).toEqual(len);
                        expect(
                            items.map((i) => [i.position, new Nature(i.nature).getTypes()]),
                        ).toEqual([
                            [0, [NatureTypes.Search]],
                            [1, [NatureTypes.Breadcrumb]],
                            [2, [NatureTypes.Breadcrumb]],
                            [5, [NatureTypes.BreadcrumbSeporator]],
                            [8, [NatureTypes.Breadcrumb]],
                            [9, [NatureTypes.Breadcrumb]],
                            [10, [NatureTypes.Search]],
                            [11, [NatureTypes.Breadcrumb]],
                            [12, [NatureTypes.Breadcrumb]],
                            [15, [NatureTypes.BreadcrumbSeporator]],
                            [18, [NatureTypes.Breadcrumb]],
                            [19, [NatureTypes.Breadcrumb]],
                            [20, [NatureTypes.Search]],
                            [21, [NatureTypes.Breadcrumb]],
                            [22, [NatureTypes.Breadcrumb]],
                            [25, [NatureTypes.BreadcrumbSeporator]],
                            [28, [NatureTypes.Breadcrumb]],
                            [29, [NatureTypes.Breadcrumb]],
                            [30, [NatureTypes.Search]],
                            [31, [NatureTypes.Breadcrumb]],
                            [32, [NatureTypes.Breadcrumb]],
                            [35, [NatureTypes.BreadcrumbSeporator]],
                            [38, [NatureTypes.Breadcrumb]],
                            [39, [NatureTypes.Breadcrumb]],
                            [40, [NatureTypes.Search]],
                            [41, [NatureTypes.Breadcrumb]],
                            [42, [NatureTypes.Breadcrumb]],
                            [45, [NatureTypes.BreadcrumbSeporator]],
                            [48, [NatureTypes.Breadcrumb]],
                            [49, [NatureTypes.Breadcrumb]],
                        ]);
                        await stream.extendBreadcrumbs(45, 2, false);
                        len = await stream.getIndexedLen();
                        expect(len).toEqual(32);
                        items = await stream.grabIndexed(0, len);
                        expect(items.length).toEqual(len);
                        expect(
                            items.map((i) => [i.position, new Nature(i.nature).getTypes()]),
                        ).toEqual([
                            [0, [NatureTypes.Search]],
                            [1, [NatureTypes.Breadcrumb]],
                            [2, [NatureTypes.Breadcrumb]],
                            [5, [NatureTypes.BreadcrumbSeporator]],
                            [8, [NatureTypes.Breadcrumb]],
                            [9, [NatureTypes.Breadcrumb]],
                            [10, [NatureTypes.Search]],
                            [11, [NatureTypes.Breadcrumb]],
                            [12, [NatureTypes.Breadcrumb]],
                            [15, [NatureTypes.BreadcrumbSeporator]],
                            [18, [NatureTypes.Breadcrumb]],
                            [19, [NatureTypes.Breadcrumb]],
                            [20, [NatureTypes.Search]],
                            [21, [NatureTypes.Breadcrumb]],
                            [22, [NatureTypes.Breadcrumb]],
                            [25, [NatureTypes.BreadcrumbSeporator]],
                            [28, [NatureTypes.Breadcrumb]],
                            [29, [NatureTypes.Breadcrumb]],
                            [30, [NatureTypes.Search]],
                            [31, [NatureTypes.Breadcrumb]],
                            [32, [NatureTypes.Breadcrumb]],
                            [35, [NatureTypes.BreadcrumbSeporator]],
                            [38, [NatureTypes.Breadcrumb]],
                            [39, [NatureTypes.Breadcrumb]],
                            [40, [NatureTypes.Search]],
                            [41, [NatureTypes.Breadcrumb]],
                            [42, [NatureTypes.Breadcrumb]],
                            [45, [NatureTypes.BreadcrumbSeporator]],
                            [46, [NatureTypes.Breadcrumb]],
                            [47, [NatureTypes.Breadcrumb]],
                            [48, [NatureTypes.Breadcrumb]],
                            [49, [NatureTypes.Breadcrumb]],
                        ]);
                        await stream.extendBreadcrumbs(45, 2, true);
                        len = await stream.getIndexedLen();
                        expect(len).toEqual(34);
                        items = await stream.grabIndexed(0, len);
                        expect(items.length).toEqual(len);
                        expect(
                            items.map((i) => [i.position, new Nature(i.nature).getTypes()]),
                        ).toEqual([
                            [0, [NatureTypes.Search]],
                            [1, [NatureTypes.Breadcrumb]],
                            [2, [NatureTypes.Breadcrumb]],
                            [5, [NatureTypes.BreadcrumbSeporator]],
                            [8, [NatureTypes.Breadcrumb]],
                            [9, [NatureTypes.Breadcrumb]],
                            [10, [NatureTypes.Search]],
                            [11, [NatureTypes.Breadcrumb]],
                            [12, [NatureTypes.Breadcrumb]],
                            [15, [NatureTypes.BreadcrumbSeporator]],
                            [18, [NatureTypes.Breadcrumb]],
                            [19, [NatureTypes.Breadcrumb]],
                            [20, [NatureTypes.Search]],
                            [21, [NatureTypes.Breadcrumb]],
                            [22, [NatureTypes.Breadcrumb]],
                            [25, [NatureTypes.BreadcrumbSeporator]],
                            [28, [NatureTypes.Breadcrumb]],
                            [29, [NatureTypes.Breadcrumb]],
                            [30, [NatureTypes.Search]],
                            [31, [NatureTypes.Breadcrumb]],
                            [32, [NatureTypes.Breadcrumb]],
                            [35, [NatureTypes.BreadcrumbSeporator]],
                            [38, [NatureTypes.Breadcrumb]],
                            [39, [NatureTypes.Breadcrumb]],
                            [40, [NatureTypes.Search]],
                            [41, [NatureTypes.Breadcrumb]],
                            [42, [NatureTypes.Breadcrumb]],
                            [43, [NatureTypes.Breadcrumb]],
                            [44, [NatureTypes.Breadcrumb]],
                            [45, [NatureTypes.Breadcrumb]],
                            [46, [NatureTypes.Breadcrumb]],
                            [47, [NatureTypes.Breadcrumb]],
                            [48, [NatureTypes.Breadcrumb]],
                            [49, [NatureTypes.Breadcrumb]],
                        ]);

                        // // Set single index
                        // await stream.setIndexes(1, [{ from: 2, to: 2 }]);
                        // items = await stream.grabIndexed(0, 3);
                        // expect(items.length).toEqual(3);
                        // expect(items.map((i) => i.position).join(',')).toEqual([0, 2, 5].join(','));
                        // // Remove index
                        // await stream.unsetIndexes(1, [{ from: 2, to: 2 }]);
                        // // Set multiple indexes
                        // await stream.setIndexes(1, [
                        //     { from: 6, to: 9 },
                        //     { from: 11, to: 14 },
                        // ]);
                        // items = await stream.grabIndexed(0, 15);
                        // expect(items.length).toEqual(15);
                        // expect(items.map((i) => i.position).join(',')).toEqual(
                        //     [0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30].join(','),
                        // );
                        // expect(
                        //     (
                        //         items.map((i) => {
                        //             return i.nature.includes(1) ? 1 : 0;
                        //         }) as number[]
                        //     ).reduce((s, a) => s + a, 0),
                        // ).toEqual(8);
                        // // Remove multiple indexes
                        // await stream.unsetIndexes(1, [
                        //     { from: 6, to: 9 },
                        //     { from: 11, to: 14 },
                        // ]);
                        // items = await stream.grabIndexed(0, 5);
                        // expect(items.length).toEqual(5);
                        // expect(items.map((i) => i.position).join(',')).toEqual(
                        //     [0, 5, 10, 15, 20].join(','),
                        // );
                        // expect(items.map((i) => i.position).join(',')).toEqual(
                        //     [0, 5, 10, 15, 20].join(','),
                        // );
                        // expect(items.map((i) => new Nature(i.nature).getTypes()).reduce((s, a) => s + a, 0)).toEqual(0);
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
    });
});
