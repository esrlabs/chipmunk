// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { IGrabbedElement } from 'platform/types/content';
import { finish, createSampleFile, performanceReport, setMeasurement, runner } from './common';
import { readConfigurationFile } from './config';

import * as os from 'os';
import * as path from 'path';

const config = readConfigurationFile().get().tests.search;

describe('Search', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[1]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    if (search instanceof Error) {
                        return finish(session, done, search);
                    }
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some match line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'match',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    search
                                        .getMap(54)
                                        .then((map) => {
                                            logger.verbose(map);
                                            search
                                                .grab(0, 11)
                                                .then((result: IGrabbedElement[]) => {
                                                    expect(result.map((i) => i.content)).toEqual([
                                                        '[0]:: some match line data',
                                                        '[1]:: some match line data',
                                                        '[2]:: some match line data',
                                                        '[3]:: some match line data',
                                                        '[4]:: some match line data',
                                                        '[5]:: some match line data',
                                                        '[100]:: some match line data',
                                                        '[200]:: some match line data',
                                                        '[300]:: some match line data',
                                                        '[400]:: some match line data',
                                                        '[500]:: some match line data',
                                                    ]);
                                                    expect(result.map((i) => i.position)).toEqual([
                                                        0, // 0
                                                        1, // 1
                                                        2, // 2
                                                        3, // 3
                                                        4, // 4
                                                        5, // 5
                                                        100, // 6
                                                        200, // 7
                                                        300, // 8
                                                        400, // 9
                                                        500, // 10
                                                    ]);
                                                    Promise.allSettled(
                                                        [
                                                            [10, 5, 5],
                                                            [110, 6, 100],
                                                            [390, 9, 400],
                                                            [600, 11, 600],
                                                        ].map((data) => {
                                                            return search
                                                                .getNearest(data[0])
                                                                .then((nearest) => {
                                                                    expect(typeof nearest).toEqual(
                                                                        'object',
                                                                    );
                                                                    expect(
                                                                        (nearest as any).index,
                                                                    ).toEqual(data[1]);
                                                                    expect(
                                                                        (nearest as any).position,
                                                                    ).toEqual(data[2]);
                                                                })
                                                                .catch((err: Error) => {
                                                                    fail(err);
                                                                });
                                                        }),
                                                    )
                                                        .then(() => {
                                                            search
                                                                .len()
                                                                .then((len: number) => {
                                                                    expect(len).toEqual(55);
                                                                    expect(
                                                                        searchStreamUpdated,
                                                                    ).toEqual(true);
                                                                    stream
                                                                        .getIndexedRanges()
                                                                        .then((ranges) => {
                                                                            expect(
                                                                                ranges[0].from,
                                                                            ).toEqual(0);
                                                                            expect(
                                                                                ranges[0].to,
                                                                            ).toEqual(5);
                                                                            expect(
                                                                                ranges.length,
                                                                            ).toEqual(50);
                                                                            for (
                                                                                let i = 1;
                                                                                i < 50;
                                                                                i += 1
                                                                            ) {
                                                                                expect(
                                                                                    ranges[i].from,
                                                                                ).toEqual(i * 100);
                                                                                expect(
                                                                                    ranges[i].to,
                                                                                ).toEqual(i * 100);
                                                                            }
                                                                            finish(session, done);
                                                                        })
                                                                        .catch((err: Error) => {
                                                                            finish(
                                                                                session,
                                                                                done,
                                                                                err,
                                                                            );
                                                                        });
                                                                })
                                                                .catch((err: Error) => {
                                                                    finish(session, done, err);
                                                                });
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab data due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
                                                            }`,
                                                        ),
                                                    );
                                                });
                                        })
                                        .catch(finish.bind(null, session, done));
                                })
                                .catch(finish.bind(null, session, done));
                        })
                        .catch(finish.bind(null, session, done));
                    let searchStreamUpdated = false;
                    events.SearchUpdated.subscribe((event) => {
                        searchStreamUpdated = true;
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
        });
    });

    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[2]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    if (search instanceof Error) {
                        finish(session, done, search);
                        return;
                    }
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some match A line data\n`
                                    : i % 50 === 0
                                    ? `some match B line data\n`
                                    : i === 9
                                    ? `some 666 line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'match A',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                    {
                                        filter: 'match B',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                    {
                                        filter: '666',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((result) => {
                                    search
                                        .grab(0, 11)
                                        .then((result: IGrabbedElement[]) => {
                                            expect(result.map((i) => i.content)).toEqual([
                                                '[0]:: some match A line data',
                                                '[1]:: some match A line data',
                                                '[2]:: some match A line data',
                                                '[3]:: some match A line data',
                                                '[4]:: some match A line data',
                                                '[5]:: some match A line data',
                                                '[9]:: some 666 line data',
                                                '[50]:: some match B line data',
                                                '[100]:: some match A line data',
                                                '[150]:: some match B line data',
                                                '[200]:: some match A line data',
                                            ]);
                                            expect(result.map((i) => i.position)).toEqual([
                                                0, // 0
                                                1, // 1
                                                2, // 2
                                                3, // 3
                                                4, // 4
                                                5, // 5
                                                9, // 6
                                                50, // 7
                                                100, // 8
                                                150, // 9
                                                200, // 10
                                            ]);
                                            Promise.allSettled(
                                                [
                                                    [5, 5, 5],
                                                    [10, 6, 9],
                                                    [55, 7, 50],
                                                    [190, 10, 200],
                                                ].map((data) => {
                                                    return search
                                                        .getNearest(data[0])
                                                        .then((nearest) => {
                                                            expect(typeof nearest).toEqual(
                                                                'object',
                                                            );
                                                            expect((nearest as any).index).toEqual(
                                                                data[1],
                                                            );
                                                            expect(
                                                                (nearest as any).position,
                                                            ).toEqual(data[2]);
                                                        })
                                                        .catch((err: Error) => {
                                                            fail(err);
                                                        });
                                                }),
                                            )
                                                .then(() => {
                                                    search
                                                        .len()
                                                        .then((len: number) => {
                                                            expect(len).toEqual(111);
                                                            finish(session, done);
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(session, done, err);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(
                                                session,
                                                done,
                                                new Error(
                                                    `Fail to grab data due error: ${
                                                        err instanceof Error ? err.message : err
                                                    }`,
                                                ),
                                            );
                                        });
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[3]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    if (search instanceof Error) {
                        finish(session, done, search);
                        return;
                    }

                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) => `[${i}]:: some line data\n`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'not relevant search',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((found) => {
                                    expect(found).toEqual(0);
                                    finish(session, done);
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[4]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    if (search instanceof Error) {
                        finish(session, done, search);
                        return;
                    }

                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some mAtCh line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'match',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    // search results available on rust side
                                    search
                                        .getMap(54)
                                        .then((map) => {
                                            search
                                                .grab(0, 11)
                                                .then((result: IGrabbedElement[]) => {
                                                    expect(result.map((i) => i.content)).toEqual([
                                                        '[0]:: some mAtCh line data',
                                                        '[1]:: some mAtCh line data',
                                                        '[2]:: some mAtCh line data',
                                                        '[3]:: some mAtCh line data',
                                                        '[4]:: some mAtCh line data',
                                                        '[5]:: some mAtCh line data',
                                                        '[100]:: some mAtCh line data',
                                                        '[200]:: some mAtCh line data',
                                                        '[300]:: some mAtCh line data',
                                                        '[400]:: some mAtCh line data',
                                                        '[500]:: some mAtCh line data',
                                                    ]);
                                                    expect(result.map((i) => i.position)).toEqual([
                                                        0, // 0
                                                        1, // 1
                                                        2, // 2
                                                        3, // 3
                                                        4, // 4
                                                        5, // 5
                                                        100, // 6
                                                        200, // 7
                                                        300, // 8
                                                        400, // 9
                                                        500, // 10
                                                    ]);
                                                    Promise.allSettled(
                                                        [
                                                            [10, 5, 5],
                                                            [110, 6, 100],
                                                            [390, 9, 400],
                                                            [600, 11, 600],
                                                        ].map((data) => {
                                                            return search
                                                                .getNearest(data[0])
                                                                .then((nearest) => {
                                                                    expect(typeof nearest).toEqual(
                                                                        'object',
                                                                    );
                                                                    expect(
                                                                        (nearest as any).index,
                                                                    ).toEqual(data[1]);
                                                                    expect(
                                                                        (nearest as any).position,
                                                                    ).toEqual(data[2]);
                                                                })
                                                                .catch((err: Error) => {
                                                                    fail(err);
                                                                });
                                                        }),
                                                    )
                                                        .then(() => {
                                                            search
                                                                .len()
                                                                .then((len: number) => {
                                                                    expect(len).toEqual(55);
                                                                    finish(session, done);
                                                                })
                                                                .catch((err: Error) => {
                                                                    finish(session, done, err);
                                                                });
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab data due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
                                                            }`,
                                                        ),
                                                    );
                                                });
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[5]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    if (search instanceof Error) {
                        finish(session, done, search);
                        return;
                    }
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some match line data\n`
                                    : `some line matchmatchmatch data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'match',
                                        flags: { reg: true, word: true, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    // search results available on rust side
                                    search
                                        .getMap(54)
                                        .then((map) => {
                                            search
                                                .grab(0, 11)
                                                .then((result: IGrabbedElement[]) => {
                                                    expect(result.map((i) => i.content)).toEqual([
                                                        '[0]:: some match line data',
                                                        '[1]:: some match line data',
                                                        '[2]:: some match line data',
                                                        '[3]:: some match line data',
                                                        '[4]:: some match line data',
                                                        '[5]:: some match line data',
                                                        '[100]:: some match line data',
                                                        '[200]:: some match line data',
                                                        '[300]:: some match line data',
                                                        '[400]:: some match line data',
                                                        '[500]:: some match line data',
                                                    ]);
                                                    expect(result.map((i) => i.position)).toEqual([
                                                        0, // 0
                                                        1, // 1
                                                        2, // 2
                                                        3, // 3
                                                        4, // 4
                                                        5, // 5
                                                        100, // 6
                                                        200, // 7
                                                        300, // 8
                                                        400, // 9
                                                        500, // 10
                                                    ]);
                                                    Promise.allSettled(
                                                        [
                                                            [10, 5, 5],
                                                            [110, 6, 100],
                                                            [390, 9, 400],
                                                            [600, 11, 600],
                                                        ].map((data) => {
                                                            return search
                                                                .getNearest(data[0])
                                                                .then((nearest) => {
                                                                    expect(typeof nearest).toEqual(
                                                                        'object',
                                                                    );
                                                                    expect(
                                                                        (nearest as any).index,
                                                                    ).toEqual(data[1]);
                                                                    expect(
                                                                        (nearest as any).position,
                                                                    ).toEqual(data[2]);
                                                                })
                                                                .catch((err: Error) => {
                                                                    fail(err);
                                                                });
                                                        }),
                                                    )
                                                        .then(() => {
                                                            search
                                                                .len()
                                                                .then((len: number) => {
                                                                    expect(len).toEqual(55);
                                                                    finish(session, done);
                                                                })
                                                                .catch((err: Error) => {
                                                                    finish(session, done, err);
                                                                });
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab data due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
                                                            }`,
                                                        ),
                                                    );
                                                });
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
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[6]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    if (search instanceof Error) {
                        return finish(session, done, search);
                    }
                    const tmpobj = createSampleFile(
                        501,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some match A ${i % 6 === 0 ? 'B' : ''} line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'match A',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                    {
                                        filter: 'match [A,B]',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    search
                                        .getMap(501)
                                        .then((map) => {
                                            expect(map[0].length).toEqual(2);
                                            expect(map[0][0][0]).toEqual(0);
                                            expect(map[0][1][0]).toEqual(1);
                                            expect(map[500][0][0]).toEqual(0);
                                            expect(map[500][1][0]).toEqual(1);
                                            logger.verbose(map);
                                            search
                                                .grab(0, 11)
                                                .then((result: IGrabbedElement[]) => {
                                                    expect(result.map((i) => i.content)).toEqual([
                                                        '[0]:: some match A B line data',
                                                        '[1]:: some match A  line data',
                                                        '[2]:: some match A  line data',
                                                        '[3]:: some match A  line data',
                                                        '[4]:: some match A  line data',
                                                        '[5]:: some match A  line data',
                                                        '[100]:: some match A  line data',
                                                        '[200]:: some match A  line data',
                                                        '[300]:: some match A B line data',
                                                        '[400]:: some match A  line data',
                                                        '[500]:: some match A  line data',
                                                    ]);
                                                    expect(result.map((i) => i.position)).toEqual([
                                                        0, // 0
                                                        1, // 1
                                                        2, // 2
                                                        3, // 3
                                                        4, // 4
                                                        5, // 5
                                                        100, // 6
                                                        200, // 7
                                                        300, // 8
                                                        400, // 9
                                                        500, // 10
                                                    ]);
                                                    search
                                                        .len()
                                                        .then((len: number) => {
                                                            expect(len).toEqual(11);
                                                            expect(searchStreamUpdated).toEqual(
                                                                true,
                                                            );
                                                            finish(session, done);
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab data due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
                                                            }`,
                                                        ),
                                                    );
                                                });
                                        })
                                        .catch(finish.bind(null, session, done));
                                })
                                .catch(finish.bind(null, session, done));
                        })
                        .catch(finish.bind(null, session, done));
                    let searchStreamUpdated = false;
                    events.SearchUpdated.subscribe((event) => {
                        searchStreamUpdated = true;
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
        });
    });

    it(config.regular.list[7], function () {
        return runner(config.regular, 7, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[7]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    if (search instanceof Error) {
                        return finish(session, done, search);
                    }
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some match ${
                                          i % 6 === 0
                                              ? 'B'
                                              : i % 4 === 0
                                              ? 'C'
                                              : i % 3 === 0
                                              ? 'D'
                                              : 'A'
                                      } line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            const calls = ['match A', 'match D', 'match C', 'match B'];
                            let canceled = 0;
                            calls.forEach((filter) => {
                                search
                                    .search([
                                        {
                                            filter,
                                            flags: { reg: true, word: false, cases: false },
                                        },
                                    ])
                                    .then((_) => {
                                        expect(canceled).toEqual(3);
                                        search
                                            .grab(0, 16)
                                            .then((result: IGrabbedElement[]) => {
                                                expect(result.map((i) => i.content)).toEqual([
                                                    '[0]:: some match B line data',
                                                    '[300]:: some match B line data',
                                                    '[600]:: some match B line data',
                                                    '[900]:: some match B line data',
                                                    '[1200]:: some match B line data',
                                                    '[1500]:: some match B line data',
                                                    '[1800]:: some match B line data',
                                                    '[2100]:: some match B line data',
                                                    '[2400]:: some match B line data',
                                                    '[2700]:: some match B line data',
                                                    '[3000]:: some match B line data',
                                                    '[3300]:: some match B line data',
                                                    '[3600]:: some match B line data',
                                                    '[3900]:: some match B line data',
                                                    '[4200]:: some match B line data',
                                                    '[4500]:: some match B line data',
                                                ]);
                                                expect(result.map((i) => i.position)).toEqual([
                                                    0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400,
                                                    2700, 3000, 3300, 3600, 3900, 4200, 4500,
                                                ]);
                                                search
                                                    .len()
                                                    .then((len: number) => {
                                                        expect(len).toEqual(17);
                                                        expect(searchStreamUpdated).toEqual(true);
                                                        finish(session, done);
                                                    })
                                                    .catch((err: Error) => {
                                                        finish(session, done, err);
                                                    });
                                            })
                                            .catch((err: Error) => {
                                                finish(
                                                    session,
                                                    done,
                                                    new Error(
                                                        `Fail to grab data due error: ${
                                                            err instanceof Error ? err.message : err
                                                        }`,
                                                    ),
                                                );
                                            });
                                    })
                                    .canceled(() => {
                                        canceled += 1;
                                    })
                                    .catch((err: Error) => {
                                        finish(session, done);
                                    });
                            });
                        })
                        .catch(finish.bind(null, session, done));
                    let searchStreamUpdated = false;
                    events.SearchUpdated.subscribe((event) => {
                        searchStreamUpdated = true;
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
        });
    });

    config.performance.run &&
        Object.keys(config.regular.execute_only).length > 0 &&
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
                                const events = session.getEvents();
                                if (events instanceof Error) {
                                    finish(session, done, events);
                                    return;
                                }
                                const search = session.getSearch();
                                if (search instanceof Error) {
                                    finish(session, done, search);
                                    return;
                                }
                                let home_dir = (process.env as any)['SH_HOME_DIR'];
                                switch (index+1) {
                                    case 1:
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .asText()
                                                    .type(Factory.FileType.Text)
                                                    .file(`${home_dir}/${test.file}`)
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .on('processing', () => {
                                                search
                                                    .search([
                                                        {
                                                            filter: 'http',
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                    ])
                                                    .catch(finish.bind(null, session, done));
                                            })
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    case 2:
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .asText()
                                                    .type(Factory.FileType.Text)
                                                    .file(`${home_dir}/${test.file}`)
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .on('processing', () => {
                                                search
                                                    .search([
                                                        {
                                                            filter: 'http://www.almhuette-raith.at',
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                        {
                                                            filter: 'com.apple.hiservices-xpcservice',
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                        {
                                                            filter: 'Google Chrome Helper',
                                                            flags: { reg: true, word: false, cases: false },
                                                        },
                                                    ])
                                                    .catch(finish.bind(null, session, done));
                                                })
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    default:
                                        finish(
                                            undefined,
                                            done,
                                            new Error(`Unsupported format: ${test.open_as}`),
                                        );
                                        return;
                                }
                                events.FileRead.subscribe(() => {
                                    const measurement = setMeasurement();
                                    const search = session.getSearch();
                                    if (search instanceof Error) {
                                        finish(session, done, search);
                                        return;
                                    }
                                    search.search([]).then((_maches: number) => {
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
