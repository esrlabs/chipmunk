// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { createSampleFile, finish, performanceReport, setMeasurement, runner } from './common';
import { readConfigurationFile } from './config';
import { Nature, IndexingMode, NatureTypes } from 'platform/types/content';

import * as os from 'os';
import * as path from 'path';

const config = readConfigurationFile().get().tests.indexes;

describe('Indexes', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            (async () => {
                try {
                    const session = await Session.create();
                    // Set provider into debug mode
                    session.debug(true);
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
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get().sterilized(),
                        )
                        .catch(finish.bind(null, session, done));
                    const updates: number[] = [];
                    events.IndexedMapUpdated.subscribe((event) => {
                        event.len > 0 && updates.push(event.len);
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
                            await stream.expandBreadcrumbs(45, 2, false);
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
                                [44, [NatureTypes.BreadcrumbSeporator]],
                                [46, [NatureTypes.Breadcrumb]],
                                [47, [NatureTypes.Breadcrumb]],
                                [48, [NatureTypes.Breadcrumb]],
                                [49, [NatureTypes.Breadcrumb]],
                            ]);
                            await stream.expandBreadcrumbs(44, 2, true);
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
                                [45, [NatureTypes.BreadcrumbSeporator]],
                                [46, [NatureTypes.Breadcrumb]],
                                [47, [NatureTypes.Breadcrumb]],
                                [48, [NatureTypes.Breadcrumb]],
                                [49, [NatureTypes.Breadcrumb]],
                            ]);
                            await stream.expandBreadcrumbs(45, 1, true);
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
                        `Fail to finish test due error: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            });
        });
    });



    config.performance.run &&
        Object.keys(config.regular.execute_only).length >= 0 &&
        Object.keys(config.performance.tests).forEach((alias: string, index: number) => {
            const test = (config.performance.tests as any)[alias];
            const testName = `${test.alias}`;
            if (test.ignore) {
                console.log(`Test "${testName}" has been ignored`);
                return;
            }
            it(testName, function () {
                return runner(
                    {
                        list: { 1: testName },
                        execute_only: [],
                        files: {},
                    },
                    1,
                    async (logger, done, collector) => {
                        const measurement = setMeasurement();
                        Session.create()
                            .then((session: Session) => {
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
                                let read: boolean = false;
                                let home_dir = (process.env as any)['SH_HOME_DIR'];
                                stream
                                    .observe(
                                        new Factory.File()
                                            .asText()
                                            .type(Factory.FileType.Text)
                                            .file(`${home_dir}/${test.file}`)
                                            .get().sterilized(),
                                    )
                                    .catch(finish.bind(null, session, done));
                                const updates: number[] = [];
                                events.IndexedMapUpdated.subscribe((event) => {
                                    event.len > 0 && updates.push(event.len);
                                });
                                events.StreamUpdated.subscribe(async () => {
                                    read = true;
                                    try {
                                        await search.search([
                                            {
                                                filter: 'HTTP',
                                                flags: { reg: true, word: true, cases: false },
                                            },
                                        ]);
                                        let items = await stream.grabIndexed(0, countMatches);
                                        await stream.setIndexingMode(IndexingMode.Breadcrumbs);
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
                                events.FileRead.subscribe(() => {
                                    const results = measurement();
                                    finish(
                                        session,
                                        done,
                                        performanceReport(
                                            testName,
                                            results.ms,
                                            test.expectation_ms,
                                            `${home_dir}/${test.file}`,
                                        )
                                            ? undefined
                                            : new Error(`${testName} is fail`),
                                    );
                                });
                            })
                            .catch((err: Error) => {
                                finish(
                                    undefined,
                                    done,
                                    new Error(
                                        `Fail to create session due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    },
                );
            });
        });

});
