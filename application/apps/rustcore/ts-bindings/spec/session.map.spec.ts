// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { ISearchMap } from '../src/interfaces/index';
import { finish, createSampleFile, runner } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.map;

describe('Map', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[index]);
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
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
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
    });

    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[index]);
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
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
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
                                            map.forEach(
                                                (lineData: number[][], lineNumber: number) => {
                                                    if (lineNumber % 100 === 0 || lineNumber < 5) {
                                                        expect(lineData.length).toEqual(1);
                                                        lineData.forEach((matches: number[]) => {
                                                            expect(matches[0]).toEqual(0);
                                                            expect(matches[1]).toEqual(1);
                                                        });
                                                    } else {
                                                        expect(lineData.length).toEqual(0);
                                                    }
                                                },
                                            );
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

    it(config.regular.list[3], function () {
        return runner(config.regular, 3, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[index]);
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
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
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
                                            map.forEach(
                                                (lineData: number[][], lineNumber: number) => {
                                                    if (
                                                        lineNumber % 100 === 0 &&
                                                        (lineNumber % 33 === 0 ||
                                                            lineNumber % 55 === 0)
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
                                                },
                                            );
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

    it(config.regular.list[4], function () {
        return runner(config.regular, 4, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[index]);
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
                            `[${i}]:: Run command ${
                                i % 100 === 0 || i < 5 ? 'echo "haha">>file.txt' : ''
                            }\n`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
                        .on('confirmed', () => {
                            search
                                .search([
                                    {
                                        filter: 'file.txt',
                                        flags: { reg: false, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    search
                                        .getMap(spec.datasetLength)
                                        .then((map: ISearchMap) => {
                                            expect(map.length).toEqual(spec.datasetLength);
                                            map.forEach(
                                                (lineData: number[][], lineNumber: number) => {
                                                    if (lineNumber % 100 === 0 || lineNumber < 5) {
                                                        expect(lineData.length).toEqual(1);
                                                        lineData.forEach((matches: number[]) => {
                                                            expect(matches[0]).toEqual(0);
                                                            expect(matches[1]).toEqual(1);
                                                        });
                                                    } else {
                                                        expect(lineData.length).toEqual(0);
                                                    }
                                                },
                                            );
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

    it(config.regular.list[5], function () {
        return runner(config.regular, 5, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[index]);
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
                            `[${i}]:: Random text ${
                                i % 100 === 0 || i < 5 ? '1:1' : ''
                            } as expected\n`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
                        .on('confirmed', () => {
                            search
                                .search([
                                    {
                                        filter: '1:1',
                                        flags: { reg: false, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    search
                                        .getMap(spec.datasetLength)
                                        .then((map: ISearchMap) => {
                                            expect(map.length).toEqual(spec.datasetLength);
                                            map.forEach(
                                                (lineData: number[][], lineNumber: number) => {
                                                    if (lineNumber % 100 === 0 || lineNumber < 5) {
                                                        expect(lineData.length).toEqual(1);
                                                        lineData.forEach((matches: number[]) => {
                                                            expect(matches[0]).toEqual(0);
                                                            expect(matches[1]).toEqual(1);
                                                        });
                                                    } else {
                                                        expect(lineData.length).toEqual(0);
                                                    }
                                                },
                                            );
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

    it(config.regular.list[6], function () {
        return runner(config.regular, 6, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[index]);
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
                            `[${i}]:: Timestamp is ${
                                i % 15 === 0 || i < 7 ? '00:00.0:1' + i : 'unknown'
                            } right now.\n`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
                        .on('confirmed', () => {
                            search
                                .search([
                                    {
                                        filter: '0.0:1',
                                        flags: { reg: false, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    search
                                        .getMap(spec.datasetLength)
                                        .then((map: ISearchMap) => {
                                            expect(map.length).toEqual(spec.datasetLength);
                                            map.forEach(
                                                (lineData: number[][], lineNumber: number) => {
                                                    if (lineNumber % 15 === 0 || lineNumber < 7) {
                                                        expect(lineData.length).toEqual(1);
                                                        lineData.forEach((matches: number[]) => {
                                                            expect(matches[0]).toEqual(0);
                                                            expect(matches[1]).toEqual(1);
                                                        });
                                                    } else {
                                                        expect(lineData.length).toEqual(0);
                                                    }
                                                },
                                            );
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

    it(config.regular.list[7], function () {
        return runner(config.regular, 7, async (logger, done, collector) => {
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[index]);
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
                            `[${i}]:: Timestamp in a longsword(${
                                i % 3 === 0 || i > 700 ? '0.0:1' + i : 'unknown'
                            })\n`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
                        .on('confirmed', () => {
                            search
                                .search([
                                    {
                                        filter: 'word(0.0:1',
                                        flags: { reg: false, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    search
                                        .getMap(spec.datasetLength)
                                        .then((map: ISearchMap) => {
                                            expect(map.length).toEqual(spec.datasetLength);
                                            map.forEach(
                                                (lineData: number[][], lineNumber: number) => {
                                                    if (lineNumber % 3 === 0 || lineNumber > 700) {
                                                        expect(lineData.length).toEqual(1);
                                                        lineData.forEach((matches: number[]) => {
                                                            expect(matches[0]).toEqual(0);
                                                            expect(matches[1]).toEqual(1);
                                                        });
                                                    } else {
                                                        expect(lineData.length).toEqual(0);
                                                    }
                                                },
                                            );
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
});
