// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { finish, createSampleFile, appendToSampleFile } from './common';
import { readConfigurationFile } from './config';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.values;
const MAX_DATASET_LEN = 65000;

describe('Values', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            let sum = 0;
            const tmpobj = createSampleFile(5000, logger, (i: number) => {
                if (i % 100 === 0 || i <= 5) {
                    sum += i;
                    return `[${i}]:: some data CPU=${i}% line data\n`;
                } else {
                    return `[${i}]:: some line data\n`;
                }
            });
            comps.stream
                .observe(
                    new Factory.File()
                        .asText()
                        .type(Factory.FileType.Text)
                        .file(tmpobj.name)
                        .get()
                        .sterilized(),
                )
                .on('processing', () => {
                    comps.search
                        .values([`CPU=(\\d{1,})`])
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
            let checked = false;
            comps.events.SearchValuesUpdated.subscribe((map) => {
                if (map === null || Object.keys(map).length === 0 || checked) {
                    // Before get results rustcore should inform FE about dropping results.
                    return;
                }
                checked = true;
                comps.search
                    .getValues(MAX_DATASET_LEN)
                    .then((data) => {
                        let control = 0;
                        data[0].forEach((pair) => {
                            control += pair[3];
                        });
                        expect(control).toEqual(sum);
                        finish(comps.session, done);
                    })
                    .catch(finish.bind(null, comps.session, done));
            });
        });
    });
    it(config.regular.list[2], function () {
        return runners.withSession(config.regular, 2, async (logger, done, comps) => {
            let sum = 0;
            const tmpobj = createSampleFile(5000, logger, (i: number) => {
                if (i % 100 === 0 || i <= 5) {
                    sum += i;
                    return `[${i}]:: some data CPU=${i}% line data\n`;
                } else {
                    return `[${i}]:: some line data\n`;
                }
            });
            let iteration = 0;
            comps.stream
                .observe(
                    new Factory.File()
                        .asText()
                        .type(Factory.FileType.Text)
                        .file(tmpobj.name)
                        .get()
                        .sterilized(),
                )
                .on('processing', () => {
                    comps.search
                        .values([`CPU=(\\d{1,})`])
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
            comps.events.SearchValuesUpdated.subscribe((map) => {
                if (map === null) {
                    // Before get results rustcore should inform FE about dropping results.
                    return;
                }
                if (iteration === 0) {
                    comps.search
                        .getValues(MAX_DATASET_LEN)
                        .then((data) => {
                            let control = 0;
                            data[0].forEach((pair) => {
                                control += pair[3];
                            });
                            expect(control).toEqual(sum);
                            const offset = 5000;
                            appendToSampleFile(tmpobj, 5000, logger, (i: number) => {
                                if (i % 100 === 0 || i <= 5) {
                                    sum += i + offset;
                                    return `[${i}]:: some data CPU=${i + offset}% line data\n`;
                                } else {
                                    return `[${i}]:: some line data\n`;
                                }
                            });
                        })
                        .catch(finish.bind(null, comps.session, done));
                    iteration += 1;
                } else if (iteration === 1) {
                    comps.search
                        .getValues(MAX_DATASET_LEN)
                        .then((data) => {
                            let control = 0;
                            data[0].forEach((pair) => {
                                control += pair[3];
                            });
                            expect(control).toEqual(sum);
                            finish(comps.session, done);
                        })
                        .catch(finish.bind(null, comps.session, done));
                } else {
                    expect(iteration).toEqual(1);
                }
            });
        });
    });
});
