// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { createSampleFile, finish } from './common';
import { readConfigurationFile } from './config';
import { Nature, IndexingMode, NatureTypes } from 'platform/types/content';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.indexes;

describe('Indexes', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            (async () => {
                let controlSum = 0;
                let countMatches = 0;
                const tmpobj = createSampleFile(50, logger, (i: number) => {
                    controlSum += i % 10 == 0 ? i : 0;
                    countMatches += i % 10 == 0 ? 1 : 0;
                    return `${i}: some line data: ${i % 10 == 0 ? `match A` : ''}\n`;
                });
                let read: boolean = false;
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
                const updates: number[] = [];
                comps.events.IndexedMapUpdated.subscribe((event) => {
                    event.len > 0 && updates.push(event.len);
                });
                comps.events.StreamUpdated.subscribe(async (rows: number) => {
                    if (rows < 50 || read) {
                        return;
                    }
                    read = true;
                    try {
                        await comps.search.search([
                            {
                                filter: 'match A',
                                flags: { reg: true, word: true, cases: false, invert: false },
                            },
                        ]);
                        let items = await comps.stream.grabIndexed(0, countMatches);
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
                        expect(items.map((i) => [i.pos, new Nature(i.nature).getTypes()])).toEqual([
                            [0, [NatureTypes.Search]],
                            [10, [NatureTypes.Search]],
                            [20, [NatureTypes.Search]],
                            [30, [NatureTypes.Search]],
                            [40, [NatureTypes.Search]],
                        ]);
                        await comps.stream.setIndexingMode(IndexingMode.Breadcrumbs);
                        let len = await comps.stream.getIndexedLen();
                        expect(len).toEqual(30);
                        items = await comps.stream.grabIndexed(0, len);
                        expect(items.length).toEqual(len);
                        expect(items.map((i) => [i.pos, new Nature(i.nature).getTypes()])).toEqual([
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
                        await comps.stream.expandBreadcrumbs(45, 2, false);
                        len = await comps.stream.getIndexedLen();
                        expect(len).toEqual(32);
                        items = await comps.stream.grabIndexed(0, len);
                        expect(items.length).toEqual(len);
                        expect(items.map((i) => [i.pos, new Nature(i.nature).getTypes()])).toEqual([
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
                        await comps.stream.expandBreadcrumbs(44, 2, true);
                        len = await comps.stream.getIndexedLen();
                        expect(len).toEqual(34);
                        items = await comps.stream.grabIndexed(0, len);
                        expect(items.length).toEqual(len);
                        expect(items.map((i) => [i.pos, new Nature(i.nature).getTypes()])).toEqual([
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
                        await comps.stream.expandBreadcrumbs(45, 1, true);
                        len = await comps.stream.getIndexedLen();
                        expect(len).toEqual(34);
                        items = await comps.stream.grabIndexed(0, len);
                        expect(items.length).toEqual(len);
                        expect(items.map((i) => [i.pos, new Nature(i.nature).getTypes()])).toEqual([
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
                        finish(comps.session, done);
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
});
