// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { ISearchMap } from 'platform/types/filter';
import { finish, createSampleFile } from './common';
import { readConfigurationFile } from './config';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.map;

describe('Map', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            const index: number = 1;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: some ${i % 100 === 0 || i < 5 ? 'match' : ''} line data }\n`,
                );
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
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: false, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.filesize);
                                        map.forEach((values: number[][], line: number) => {
                                            if (line % 100 === 0 || line < 5) {
                                                expect(values.length).toEqual(1);
                                                values.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(0);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            } else {
                                                expect(values.length).toEqual(0);
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[2], function () {
        return runners.withSession(config.regular, 2, async (logger, done, comps) => {
            const index: number = 2;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: some ${i % 100 === 0 || i < 5 ? 'match' : ''} line data }\n`,
                );
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
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: false, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.datasetLength);
                                        map.forEach((lineData: number[][], lineNumber: number) => {
                                            if (lineNumber % 100 === 0 || lineNumber < 5) {
                                                expect(lineData.length).toEqual(1);
                                                lineData.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(0);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            } else {
                                                expect(lineData.length).toEqual(0);
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[3], function () {
        return runners.withSession(config.regular, 3, async (logger, done, comps) => {
            const index: number = 3;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: some ${i % 100 === 0 ? 'match' : ''} line data ${
                            i % 33 === 0 || i % 55 === 0 ? 'not' : ''
                        }\n`,
                );
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
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: false, word: false, cases: true , invert: false },
                                },
                                {
                                    filter: 'not',
                                    flags: { reg: false, word: false, cases: false , invert: false },
                                },
                                {
                                    filter: 'line',
                                    flags: { reg: false, word: false, cases: true , invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.datasetLength);
                                        map.forEach((lineData: number[][], lineNumber: number) => {
                                            if (
                                                lineNumber % 100 === 0 &&
                                                (lineNumber % 33 === 0 || lineNumber % 55 === 0)
                                            ) {
                                                expect(lineData.length).toEqual(3);
                                                lineData.forEach((matches: number[]) => {
                                                    if (
                                                        matches[0] === 0 ||
                                                        matches[0] === 1 ||
                                                        matches[0] === 2
                                                    ) {
                                                        expect(matches[1]).toEqual(1);
                                                    } else {
                                                        expect(matches[0]).toBeUndefined();
                                                        expect(matches[1]).toBeUndefined();
                                                    }
                                                });
                                            } else if (lineNumber % 100 === 0) {
                                                expect(lineData.length).toEqual(2);
                                                lineData.forEach((matches: number[]) => {
                                                    if (matches[0] === 0) {
                                                        expect(matches[1]).toEqual(1);
                                                    } else if (matches[0] === 2) {
                                                        expect(matches[1]).toEqual(1);
                                                    } else {
                                                        expect(matches[0]).toBeUndefined();
                                                        expect(matches[1]).toBeUndefined();
                                                    }
                                                });
                                            } else if (
                                                lineNumber % 33 === 0 ||
                                                lineNumber % 55 === 0
                                            ) {
                                                expect(lineData.length).toEqual(2);
                                                lineData.forEach((matches: number[]) => {
                                                    if (matches[0] === 1) {
                                                        expect(matches[1]).toEqual(1);
                                                    } else if (matches[0] === 2) {
                                                        expect(matches[1]).toEqual(1);
                                                    } else {
                                                        expect(matches[0]).toBeUndefined();
                                                        expect(matches[1]).toBeUndefined();
                                                    }
                                                });
                                            } else {
                                                expect(lineData.length).toEqual(1);
                                                lineData.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(2);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[4], function () {
        return runners.withSession(config.regular, 4, async (logger, done, comps) => {
            const index: number = 4;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: Run command ${
                            i % 100 === 0 || i < 5 ? 'echo "haha">>file.txt' : ''
                        }\n`,
                );
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
                            .search([
                                {
                                    filter: 'file.txt',
                                    flags: { reg: false, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.datasetLength);
                                        map.forEach((lineData: number[][], lineNumber: number) => {
                                            if (lineNumber % 100 === 0 || lineNumber < 5) {
                                                expect(lineData.length).toEqual(1);
                                                lineData.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(0);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            } else {
                                                expect(lineData.length).toEqual(0);
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[5], function () {
        return runners.withSession(config.regular, 5, async (logger, done, comps) => {
            const index: number = 5;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: Random text ${i % 100 === 0 || i < 5 ? '1:1' : ''} as expected\n`,
                );
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
                            .search([
                                {
                                    filter: '1:1',
                                    flags: { reg: false, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.datasetLength);
                                        map.forEach((lineData: number[][], lineNumber: number) => {
                                            if (lineNumber % 100 === 0 || lineNumber < 5) {
                                                expect(lineData.length).toEqual(1);
                                                lineData.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(0);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            } else {
                                                expect(lineData.length).toEqual(0);
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[6], function () {
        return runners.withSession(config.regular, 6, async (logger, done, comps) => {
            const index: number = 6;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: Timestamp is ${
                            i % 15 === 0 || i < 7 ? '00:00.0:1' + i : 'unknown'
                        } right now.\n`,
                );
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
                            .search([
                                {
                                    filter: '0.0:1',
                                    flags: { reg: false, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.datasetLength);
                                        map.forEach((lineData: number[][], lineNumber: number) => {
                                            if (lineNumber % 15 === 0 || lineNumber < 7) {
                                                expect(lineData.length).toEqual(1);
                                                lineData.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(0);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            } else {
                                                expect(lineData.length).toEqual(0);
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[7], function () {
        return runners.withSession(config.regular, 7, async (logger, done, comps) => {
            const index: number = 7;
            if (
                config.regular.spec === undefined ||
                config.regular.spec.map === undefined ||
                config.regular.spec.map[index] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #${index} required specification: map.regular.spec`),
                );
            }
            const spec = config.regular.spec.map[index];
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: Timestamp in a longsword(${
                            i % 3 === 0 || i > 700 ? '0.0:1' + i : 'unknown'
                        })\n`,
                );
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
                            .search([
                                {
                                    filter: 'word(0.0:1',
                                    flags: { reg: false, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                comps.search
                                    .getMap(spec.datasetLength)
                                    .then((map: ISearchMap) => {
                                        expect(map.length).toEqual(spec.datasetLength);
                                        map.forEach((lineData: number[][], lineNumber: number) => {
                                            if (lineNumber % 3 === 0 || lineNumber > 700) {
                                                expect(lineData.length).toEqual(1);
                                                lineData.forEach((matches: number[]) => {
                                                    expect(matches[0]).toEqual(0);
                                                    expect(matches[1]).toEqual(1);
                                                });
                                            } else {
                                                expect(lineData.length).toEqual(0);
                                            }
                                        });
                                        finish(comps.session, done);
                                    })
                                    .catch(finish.bind(null, comps.session, done));
                            })
                            .catch(finish.bind(null, comps.session, done));
                    })
                    .catch(finish.bind(null, comps.session, done));
        });
    });
});
