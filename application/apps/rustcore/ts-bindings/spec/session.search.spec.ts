// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.search;

function ingore(id: string | number, done: () => void) {
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

describe('Search', function () {
    it(config.regular.list[1], function (done) {
        if (ingore(1, done)) {
            return;
        }
        const logger = getLogger(config.regular.list[1]);
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
                            i % 100 === 0 || i <= 5 ? `some match line data\n` : `some line data\n`
                        }`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
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

    it(config.regular.list[2], function (done) {
        if (ingore(2, done)) {
            return;
        }
        const logger = getLogger(config.regular.list[2]);
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
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
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
                                                        expect(typeof nearest).toEqual('object');
                                                        expect((nearest as any).index).toEqual(
                                                            data[1],
                                                        );
                                                        expect((nearest as any).position).toEqual(
                                                            data[2],
                                                        );
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

    it(config.regular.list[3], function (done) {
        if (ingore(3, done)) {
            return;
        }
        const logger = getLogger(config.regular.list[3]);
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
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
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

    it(config.regular.list[4], function (done) {
        if (ingore(4, done)) {
            return;
        }
        const logger = getLogger(config.regular.list[4]);
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
                            i % 100 === 0 || i <= 5 ? `some mAtCh line data\n` : `some line data\n`
                        }`,
                );
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
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

    it(config.regular.list[5], function (done) {
        if (ingore(5, done)) {
            return;
        }
        const logger = getLogger(config.regular.list[5]);
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
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
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
