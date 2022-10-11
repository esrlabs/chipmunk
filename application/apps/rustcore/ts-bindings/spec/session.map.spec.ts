// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { ISearchMap } from '../src/interfaces/index';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.map;

describe('Map', function () {
    it(config.regular.list[1], function (done) {
        if (
            config.regular.spec === undefined ||
            config.regular.spec.map === undefined ||
            config.regular.spec.map[1] === undefined
        ) {
            return finish(
                undefined,
                done,
                new Error(`For test #1 required specification: map.regular.spec`),
            );
        }
        const spec = config.regular.spec.map[1];
        const logger = getLogger(config.regular.list[1]);
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, config.regular.list[1]);
                const stream = session.getStream();
                const search = session.getSearch();
                if (stream instanceof Error) {
                    return finish(session, done, stream);
                }
                if (search instanceof Error) {
                    return finish(session, done, search);
                }
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: some ${i % 100 === 0 || i < 5 ? 'match' : ''} line data }\n`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
                        search
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: false, word: false, cases: false },
                                },
                            ])
                            .then((_) => {
                                search
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
                                        finish(session, done);
                                    })
                                    .catch(finish.bind(null, session, done));
                            })
                            .catch(finish.bind(null, session, done));
                    })
                    .catch(finish.bind(null, session, done));
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
    });

    it(config.regular.list[2], function (done) {
        if (
            config.regular.spec === undefined ||
            config.regular.spec.map === undefined ||
            config.regular.spec.map[2] === undefined
        ) {
            return finish(
                undefined,
                done,
                new Error(`For test #2 required specification: map.regular.spec`),
            );
        }
        const spec = config.regular.spec.map[2];
        const logger = getLogger(config.regular.list[2]);
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, config.regular.list[2]);
                const stream = session.getStream();
                const search = session.getSearch();
                if (stream instanceof Error) {
                    return finish(session, done, stream);
                }
                if (search instanceof Error) {
                    return finish(session, done, search);
                }
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: some ${i % 100 === 0 || i < 5 ? 'match' : ''} line data }\n`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
                        search
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: false, word: false, cases: false },
                                },
                            ])
                            .then((_) => {
                                search
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
                                        finish(session, done);
                                    })
                                    .catch(finish.bind(null, session, done));
                            })
                            .catch(finish.bind(null, session, done));
                    })
                    .catch(finish.bind(null, session, done));
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
    });

    it(config.regular.list[3], function (done) {
        if (
            config.regular.spec === undefined ||
            config.regular.spec.map === undefined ||
            config.regular.spec.map[3] === undefined
        ) {
            return finish(
                undefined,
                done,
                new Error(`For test #3 required specification: map.regular.spec`),
            );
        }
        const spec = config.regular.spec.map[3];
        const logger = getLogger(config.regular.list[3]);
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, config.regular.list[3]);
                const stream = session.getStream();
                const search = session.getSearch();
                if (stream instanceof Error) {
                    return finish(session, done, stream);
                }
                if (search instanceof Error) {
                    return finish(session, done, search);
                }
                const tmpobj = createSampleFile(
                    spec.filesize,
                    logger,
                    (i: number) =>
                        `[${i}]:: some ${i % 100 === 0 ? 'match' : ''} line data ${
                            i % 33 === 0 || i % 55 === 0 ? 'not' : ''
                        }\n`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
                        search
                            .search([
                                {
                                    filter: 'match',
                                    flags: { reg: false, word: false, cases: true },
                                },
                                {
                                    filter: 'not',
                                    flags: { reg: false, word: false, cases: false },
                                },
                                {
                                    filter: 'line',
                                    flags: { reg: false, word: false, cases: true },
                                },
                            ])
                            .then((_) => {
                                search
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
                                        finish(session, done);
                                    })
                                    .catch(finish.bind(null, session, done));
                            })
                            .catch(finish.bind(null, session, done));
                    })
                    .catch(finish.bind(null, session, done));
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
    });
});
