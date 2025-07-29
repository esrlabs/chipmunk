// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { GrabbedElement } from 'platform/types/bindings';
import { finish, createSampleFile } from './common';
import { readConfigurationFile } from './config';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.search;

describe('Search', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) =>
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some match line data\n` : `some line data\n`
                    }`,
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
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                        ])
                        .then((_) => {
                            comps.search
                                .getMap(54)
                                .then((map) => {
                                    logger.verbose(map);
                                    comps.search
                                        .grab(0, 11)
                                        .then((result: GrabbedElement[]) => {
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
                                            console.log(`GRABBED`);
                                            console.log(result);
                                            expect(result.map((i) => i.pos)).toEqual([
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
                                                    return comps.search
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
                                                    comps.search
                                                        .len()
                                                        .then((len: number) => {
                                                            expect(len).toEqual(55);
                                                            expect(searchStreamUpdated).toEqual(
                                                                true,
                                                            );
                                                            comps.stream
                                                                .getIndexedRanges()
                                                                .then((ranges) => {
                                                                    expect(ranges[0].start).toEqual(
                                                                        0,
                                                                    );
                                                                    expect(ranges[0].end).toEqual(
                                                                        5,
                                                                    );
                                                                    expect(ranges.length).toEqual(
                                                                        50,
                                                                    );
                                                                    for (
                                                                        let i = 1;
                                                                        i < 50;
                                                                        i += 1
                                                                    ) {
                                                                        expect(
                                                                            ranges[i].start,
                                                                        ).toEqual(i * 100);
                                                                        expect(
                                                                            ranges[i].end,
                                                                        ).toEqual(i * 100);
                                                                    }
                                                                    finish(comps.session, done);
                                                                })
                                                                .catch((err: Error) => {
                                                                    finish(
                                                                        comps.session,
                                                                        done,
                                                                        err,
                                                                    );
                                                                });
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(comps.session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(comps.session, done, err);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(
                                                comps.session,
                                                done,
                                                new Error(
                                                    `Fail to grab data due error: ${
                                                        err instanceof Error ? err.message : err
                                                    }`,
                                                ),
                                            );
                                        });
                                })
                                .catch(finish.bind(null, comps.session, done));
                        })
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
            let searchStreamUpdated = false;
            comps.events.SearchUpdated.subscribe((event) => {
                searchStreamUpdated = true;
            });
        });
    });

    it(config.regular.list[2], function () {
        return runners.withSession(config.regular, 2, async (logger, done, comps) => {
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
                                filter: 'match A',
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                            {
                                filter: 'match B',
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                            {
                                filter: '666',
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                        ])
                        .then((result) => {
                            comps.search
                                .grab(0, 11)
                                .then((result: GrabbedElement[]) => {
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
                                    expect(result.map((i) => i.pos)).toEqual([
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
                                            return comps.search
                                                .getNearest(data[0])
                                                .then((nearest) => {
                                                    expect(typeof nearest).toEqual('object');
                                                    expect((nearest as any).index).toEqual(data[1]);
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
                                            comps.search
                                                .len()
                                                .then((len: number) => {
                                                    expect(len).toEqual(111);
                                                    finish(comps.session, done);
                                                })
                                                .catch((err: Error) => {
                                                    finish(comps.session, done, err);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(comps.session, done, err);
                                        });
                                })
                                .catch((err: Error) => {
                                    finish(
                                        comps.session,
                                        done,
                                        new Error(
                                            `Fail to grab data due error: ${
                                                err instanceof Error ? err.message : err
                                            }`,
                                        ),
                                    );
                                });
                        })
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[3], function () {
        return runners.withSession(config.regular, 3, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) => `[${i}]:: some line data\n`,
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
                                filter: 'not relevant search',
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                        ])
                        .then((found) => {
                            expect(found).toEqual(0);
                            finish(comps.session, done);
                        })
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[4], function () {
        return runners.withSession(config.regular, 4, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) =>
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some mAtCh line data\n` : `some line data\n`
                    }`,
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
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                        ])
                        .then((_) => {
                            // search results available on rust side
                            comps.search
                                .getMap(54)
                                .then((map) => {
                                    comps.search
                                        .grab(0, 11)
                                        .then((result: GrabbedElement[]) => {
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
                                            expect(result.map((i) => i.pos)).toEqual([
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
                                                    return comps.search
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
                                                    comps.search
                                                        .len()
                                                        .then((len: number) => {
                                                            expect(len).toEqual(55);
                                                            finish(comps.session, done);
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(comps.session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(comps.session, done, err);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(
                                                comps.session,
                                                done,
                                                new Error(
                                                    `Fail to grab data due error: ${
                                                        err instanceof Error ? err.message : err
                                                    }`,
                                                ),
                                            );
                                        });
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
                                flags: { reg: true, word: true, cases: false, invert: false },
                            },
                        ])
                        .then((_) => {
                            // search results available on rust side
                            comps.search
                                .getMap(54)
                                .then((map) => {
                                    comps.search
                                        .grab(0, 11)
                                        .then((result: GrabbedElement[]) => {
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
                                            expect(result.map((i) => i.pos)).toEqual([
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
                                                    return comps.search
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
                                                    comps.search
                                                        .len()
                                                        .then((len: number) => {
                                                            expect(len).toEqual(55);
                                                            finish(comps.session, done);
                                                        })
                                                        .catch((err: Error) => {
                                                            finish(comps.session, done, err);
                                                        });
                                                })
                                                .catch((err: Error) => {
                                                    finish(comps.session, done, err);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(
                                                comps.session,
                                                done,
                                                new Error(
                                                    `Fail to grab data due error: ${
                                                        err instanceof Error ? err.message : err
                                                    }`,
                                                ),
                                            );
                                        });
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
                                filter: 'match A',
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                            {
                                filter: 'match [A,B]',
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                        ])
                        .then((_) => {
                            comps.search
                                .getMap(501)
                                .then((map) => {
                                    expect(map[0].length).toEqual(2);
                                    expect(map[0][0][0]).toEqual(0);
                                    expect(map[0][1][0]).toEqual(1);
                                    expect(map[500][0][0]).toEqual(0);
                                    expect(map[500][1][0]).toEqual(1);
                                    logger.verbose(map);
                                    comps.search
                                        .grab(0, 11)
                                        .then((result: GrabbedElement[]) => {
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
                                            expect(result.map((i) => i.pos)).toEqual([
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
                                            comps.search
                                                .len()
                                                .then((len: number) => {
                                                    expect(len).toEqual(11);
                                                    expect(searchStreamUpdated).toEqual(true);
                                                    finish(comps.session, done);
                                                })
                                                .catch((err: Error) => {
                                                    finish(comps.session, done, err);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(
                                                comps.session,
                                                done,
                                                new Error(
                                                    `Fail to grab data due error: ${
                                                        err instanceof Error ? err.message : err
                                                    }`,
                                                ),
                                            );
                                        });
                                })
                                .catch(finish.bind(null, comps.session, done));
                        })
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
            let searchStreamUpdated = false;
            comps.events.SearchUpdated.subscribe((event) => {
                searchStreamUpdated = true;
            });
        });
    });

    it(config.regular.list[7], function () {
        return runners.withSession(config.regular, 7, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) =>
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5
                            ? `some match ${
                                  i % 6 === 0 ? 'B' : i % 4 === 0 ? 'C' : i % 3 === 0 ? 'D' : 'A'
                              } line data\n`
                            : `some line data\n`
                    }`,
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
                    const calls = ['match A', 'match D', 'match C', 'match B'];
                    let canceled = 0;
                    calls.forEach((filter) => {
                        comps.search
                            .search([
                                {
                                    filter,
                                    flags: { reg: true, word: false, cases: false, invert: false },
                                },
                            ])
                            .then((_) => {
                                expect(canceled).toEqual(3);
                                comps.search
                                    .grab(0, 16)
                                    .then((result: GrabbedElement[]) => {
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
                                        expect(result.map((i) => i.pos)).toEqual([
                                            0, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700,
                                            3000, 3300, 3600, 3900, 4200, 4500,
                                        ]);
                                        comps.search
                                            .len()
                                            .then((len: number) => {
                                                expect(len).toEqual(17);
                                                expect(searchStreamUpdated).toEqual(true);
                                                finish(comps.session, done);
                                            })
                                            .catch((err: Error) => {
                                                finish(comps.session, done, err);
                                            });
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                                finish(comps.session, done);
                            });
                    });
                })
                .catch(finish.bind(null, comps.session, done));
            let searchStreamUpdated = false;
            comps.events.SearchUpdated.subscribe((event) => {
                searchStreamUpdated = true;
            });
        });
    });

    it(config.regular.list[8], function () {
        return runners.withSession(config.regular, 8, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) =>
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5
                            ? `some match line ${i % 500 === 0 ? 'Nested' : ''} data\n`
                            : `some line ${i % 500 === 0 ? 'Nested' : ''} data\n`
                    }`,
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
                                flags: { reg: true, word: false, cases: false, invert: false },
                            },
                        ])
                        .then((_) => {
                            comps.search
                                .searchNestedMatch(
                                    {
                                        filter: 'Nested',
                                        flags: { reg: true, cases: false, word: false, invert: false },
                                    },
                                    10,
                                    false,
                                )
                                .then((pos: [number, number] | undefined) => {
                                    expect((pos as [number, number])[0]).toBe(500);
                                    expect((pos as [number, number])[1]).toBe(10);
                                    finish(comps.session, done);
                                })
                                .catch(finish.bind(null, comps.session, done));
                        })
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
            let searchStreamUpdated = false;
            comps.events.SearchUpdated.subscribe((event) => {
                searchStreamUpdated = true;
            });
        });
    });
});
