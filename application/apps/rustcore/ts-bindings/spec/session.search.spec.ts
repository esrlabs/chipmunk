// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Search', function () {
    it('Test 1. Assign & single search', function (done) {
        const logger = getLogger('Search. Test 1');
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, 'Test 1. Assign & single search');
                const stream = session.getStream();
                const search = session.getSearch();
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
                stream.assign(tmpobj.name, {}).catch(finish.bind(null, session, done));
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
                                    .grab(0, 10)
                                    .then((result: IGrabbedElement[]) => {
                                        console.log(result);
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
                                        expect(result.map((i) => i.row)).toEqual([
                                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
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
                                                `Fail to grab data due error: ${err.message}`,
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
                    new Error(`Fail to create session due error: ${err.message}`),
                );
            });
    });

    // it('Test 2. Assign & multiple search', function (done) {
    //     const logger = getLogger('Search. Test 2');
    //     const session = new Session();
    //     // Set provider into debug mode
    //     session.debug(true, 'Test 2. Assign & multiple search');
    //     const stream = session.getStream();
    //     const search = session.getSearch();
    //     if (stream instanceof Error) {
    //         finish(session, done, stream);
    //         return;
    //     }
    //     if (search instanceof Error) {
    //         finish(session, done, search);
    //         return;
    //     }

    //     const tmpobj = createSampleFile(
    //         5000,
    //         logger,
    //         (i: number) =>
    //             `[${i}]:: ${
    //                 i % 100 === 0 || i <= 5
    //                     ? `some match A line data\n`
    //                     : i % 50 === 0
    //                     ? `some match B line data\n`
    //                     : i === 9
    //                     ? `some 666 line data\n`
    //                     : `some line data\n`
    //             }`,
    //     );
    //     stream
    //         .assign(tmpobj.name, {})
    //         .then(() => {
    //             search
    //                 .search([
    //                     {
    //                         filter: 'match A',
    //                         flags: { reg: true, word: false, cases: false },
    //                     },
    //                     {
    //                         filter: 'match B',
    //                         flags: { reg: true, word: false, cases: false },
    //                     },
    //                     {
    //                         filter: '666',
    //                         flags: { reg: true, word: false, cases: false },
    //                     },
    //                 ])
    //                 .then(() => {
    //                     search
    //                         .grab(0, 10)
    //                         .then((result: IGrabbedElement[]) => {
    //                             expect(result.map((i) => i.content)).toEqual([
    //                                 '[0]:: some match A line data',
    //                                 '[1]:: some match A line data',
    //                                 '[2]:: some match A line data',
    //                                 '[3]:: some match A line data',
    //                                 '[4]:: some match A line data',
    //                                 '[5]:: some match A line data',
    //                                 '[9]:: some 666 line data',
    //                                 '[50]:: some match B line data',
    //                                 '[100]:: some match A line data',
    //                                 '[150]:: some match B line data',
    //                                 '[200]:: some match A line data',
    //                             ]);
    //                             expect(result.map((i) => i.row)).toEqual([
    //                                 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    //                             ]);
    //                             expect(result.map((i) => i.position)).toEqual([
    //                                 0, // 0
    //                                 1, // 1
    //                                 2, // 2
    //                                 3, // 3
    //                                 4, // 4
    //                                 5, // 5
    //                                 9, // 6
    //                                 50, // 7
    //                                 100, // 8
    //                                 150, // 9
    //                                 200, // 10
    //                             ]);
    //                             Promise.allSettled(
    //                                 [
    //                                     [5, 5, 5],
    //                                     [10, 6, 9],
    //                                     [55, 7, 50],
    //                                     [190, 10, 200],
    //                                 ].map((data) => {
    //                                     return search
    //                                         .getNearest(data[0])
    //                                         .then((nearest) => {
    //                                             expect(typeof nearest).toEqual('object');
    //                                             expect((nearest as any).index).toEqual(data[1]);
    //                                             expect((nearest as any).position).toEqual(data[2]);
    //                                         })
    //                                         .catch((err: Error) => {
    //                                             fail(err);
    //                                         });
    //                                 }),
    //                             )
    //                                 .then(() => {
    //                                     search
    //                                         .len()
    //                                         .then((len: number) => {
    //                                             expect(len).toEqual(111);
    //                                             finish(session, done);
    //                                         })
    //                                         .catch((err: Error) => {
    //                                             finish(session, done, err);
    //                                         });
    //                                 })
    //                                 .catch((err: Error) => {
    //                                     finish(session, done, err);
    //                                 });
    //                         })
    //                         .catch((err: Error) => {
    //                             finish(
    //                                 session,
    //                                 done,
    //                                 new Error(`Fail to grab data due error: ${err.message}`),
    //                             );
    //                         });
    //                 })
    //                 .catch(finish.bind(null, session, done));
    //         })
    //         .catch(finish.bind(null, session, done));
    // });

    // it('Test 3. Assign & zero search', function (done) {
    //     const logger = getLogger('Search. Test 3');
    //     const session = new Session();
    //     // Set provider into debug mode
    //     session.debug(true, 'Test 3. Assign & zero search');
    //     const stream = session.getStream();
    //     const search = session.getSearch();
    //     if (stream instanceof Error) {
    //         finish(session, done, stream);
    //         return;
    //     }
    //     if (search instanceof Error) {
    //         finish(session, done, search);
    //         return;
    //     }

    //     const tmpobj = createSampleFile(5000, logger, (i: number) => `[${i}]:: some line data\n`);
    //     stream
    //         .assign(tmpobj.name, {})
    //         .then(() => {
    //             search
    //                 .search([
    //                     {
    //                         filter: 'not relevant search',
    //                         flags: { reg: true, word: false, cases: false },
    //                     },
    //                 ])
    //                 .then(() => {
    //                     search
    //                         .grab(0, 10)
    //                         .then((result: IGrabbedElement[]) => {
    //                             search
    //                                 .len()
    //                                 .then((len: number) => {
    //                                     expect(len).toEqual(0);
    //                                     finish(session, done);
    //                                 })
    //                                 .catch((err: Error) => {
    //                                     finish(session, done, err);
    //                                 });
    //                         })
    //                         .catch((err: Error) => {
    //                             finish(
    //                                 session,
    //                                 done,
    //                                 new Error(`Fail to grab data due error: ${err.message}`),
    //                             );
    //                         });
    //                 })
    //                 .catch(finish.bind(null, session, done));
    //         })
    //         .catch(finish.bind(null, session, done));
    // });

    // it('Test 4. Assign & single not case sensitive search', function (done) {
    //     const logger = getLogger('Search. Test 4');
    //     const session = new Session();
    //     // Set provider into debug mode
    //     session.debug(true, 'Test 4. Assign & single not case sensitive search');
    //     const stream = session.getStream();
    //     const search = session.getSearch();
    //     if (stream instanceof Error) {
    //         finish(session, done, stream);
    //         return;
    //     }
    //     if (search instanceof Error) {
    //         finish(session, done, search);
    //         return;
    //     }

    //     const tmpobj = createSampleFile(
    //         5000,
    //         logger,
    //         (i: number) =>
    //             `[${i}]:: ${
    //                 i % 100 === 0 || i <= 5 ? `some mAtCh line data\n` : `some line data\n`
    //             }`,
    //     );
    //     stream
    //         .assign(tmpobj.name, {})
    //         .then(() => {
    //             // metadata was created
    //             search
    //                 .search([
    //                     {
    //                         filter: 'match',
    //                         flags: { reg: true, word: false, cases: false },
    //                     },
    //                 ])
    //                 .then((_) => {
    //                     // search results available on rust side
    //                     search
    //                         .getMap(54)
    //                         .then((map) => {
    //                             search
    //                                 .grab(0, 10)
    //                                 .then((result: IGrabbedElement[]) => {
    //                                     expect(result.map((i) => i.content)).toEqual([
    //                                         '[0]:: some mAtCh line data',
    //                                         '[1]:: some mAtCh line data',
    //                                         '[2]:: some mAtCh line data',
    //                                         '[3]:: some mAtCh line data',
    //                                         '[4]:: some mAtCh line data',
    //                                         '[5]:: some mAtCh line data',
    //                                         '[100]:: some mAtCh line data',
    //                                         '[200]:: some mAtCh line data',
    //                                         '[300]:: some mAtCh line data',
    //                                         '[400]:: some mAtCh line data',
    //                                         '[500]:: some mAtCh line data',
    //                                     ]);
    //                                     expect(result.map((i) => i.row)).toEqual([
    //                                         0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    //                                     ]);
    //                                     expect(result.map((i) => i.position)).toEqual([
    //                                         0, // 0
    //                                         1, // 1
    //                                         2, // 2
    //                                         3, // 3
    //                                         4, // 4
    //                                         5, // 5
    //                                         100, // 6
    //                                         200, // 7
    //                                         300, // 8
    //                                         400, // 9
    //                                         500, // 10
    //                                     ]);
    //                                     Promise.allSettled(
    //                                         [
    //                                             [10, 5, 5],
    //                                             [110, 6, 100],
    //                                             [390, 9, 400],
    //                                             [600, 11, 600],
    //                                         ].map((data) => {
    //                                             return search
    //                                                 .getNearest(data[0])
    //                                                 .then((nearest) => {
    //                                                     expect(typeof nearest).toEqual('object');
    //                                                     expect((nearest as any).index).toEqual(
    //                                                         data[1],
    //                                                     );
    //                                                     expect((nearest as any).position).toEqual(
    //                                                         data[2],
    //                                                     );
    //                                                 })
    //                                                 .catch((err: Error) => {
    //                                                     fail(err);
    //                                                 });
    //                                         }),
    //                                     )
    //                                         .then(() => {
    //                                             search
    //                                                 .len()
    //                                                 .then((len: number) => {
    //                                                     expect(len).toEqual(55);
    //                                                     finish(session, done);
    //                                                 })
    //                                                 .catch((err: Error) => {
    //                                                     finish(session, done, err);
    //                                                 });
    //                                         })
    //                                         .catch((err: Error) => {
    //                                             finish(session, done, err);
    //                                         });
    //                                 })
    //                                 .catch((err: Error) => {
    //                                     finish(
    //                                         session,
    //                                         done,
    //                                         new Error(
    //                                             `Fail to grab data due error: ${err.message}`,
    //                                         ),
    //                                     );
    //                                 });
    //                         })
    //                         .catch(finish.bind(null, session, done));
    //                 })
    //                 .catch(finish.bind(null, session, done));
    //         })
    //         .catch(finish.bind(null, session, done));
    // });

    // it('Test 5. Assign & single word search', function (done) {
    //     const logger = getLogger('Search. Test 5');
    //     const session = new Session();
    //     // Set provider into debug mode
    //     session.debug(true, 'Test 5. Assign & single word search');
    //     const stream = session.getStream();
    //     const search = session.getSearch();
    //     if (stream instanceof Error) {
    //         finish(session, done, stream);
    //         return;
    //     }
    //     if (search instanceof Error) {
    //         finish(session, done, search);
    //         return;
    //     }

    //     const tmpobj = createSampleFile(
    //         5000,
    //         logger,
    //         (i: number) =>
    //             `[${i}]:: ${
    //                 i % 100 === 0 || i <= 5
    //                     ? `some match line data\n`
    //                     : `some line matchmatchmatch data\n`
    //             }`,
    //     );
    //     stream
    //         .assign(tmpobj.name, {})
    //         .then(() => {
    //             // metadata was created
    //             search
    //                 .search([
    //                     {
    //                         filter: 'match',
    //                         flags: { reg: true, word: true, cases: false },
    //                     },
    //                 ])
    //                 .then((_) => {
    //                     // search results available on rust side
    //                     search
    //                         .getMap(54)
    //                         .then((map) => {
    //                             search
    //                                 .grab(0, 10)
    //                                 .then((result: IGrabbedElement[]) => {
    //                                     expect(result.map((i) => i.content)).toEqual([
    //                                         '[0]:: some match line data',
    //                                         '[1]:: some match line data',
    //                                         '[2]:: some match line data',
    //                                         '[3]:: some match line data',
    //                                         '[4]:: some match line data',
    //                                         '[5]:: some match line data',
    //                                         '[100]:: some match line data',
    //                                         '[200]:: some match line data',
    //                                         '[300]:: some match line data',
    //                                         '[400]:: some match line data',
    //                                         '[500]:: some match line data',
    //                                     ]);
    //                                     expect(result.map((i) => i.row)).toEqual([
    //                                         0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    //                                     ]);
    //                                     expect(result.map((i) => i.position)).toEqual([
    //                                         0, // 0
    //                                         1, // 1
    //                                         2, // 2
    //                                         3, // 3
    //                                         4, // 4
    //                                         5, // 5
    //                                         100, // 6
    //                                         200, // 7
    //                                         300, // 8
    //                                         400, // 9
    //                                         500, // 10
    //                                     ]);
    //                                     Promise.allSettled(
    //                                         [
    //                                             [10, 5, 5],
    //                                             [110, 6, 100],
    //                                             [390, 9, 400],
    //                                             [600, 11, 600],
    //                                         ].map((data) => {
    //                                             return search
    //                                                 .getNearest(data[0])
    //                                                 .then((nearest) => {
    //                                                     expect(typeof nearest).toEqual('object');
    //                                                     expect((nearest as any).index).toEqual(
    //                                                         data[1],
    //                                                     );
    //                                                     expect((nearest as any).position).toEqual(
    //                                                         data[2],
    //                                                     );
    //                                                 })
    //                                                 .catch((err: Error) => {
    //                                                     fail(err);
    //                                                 });
    //                                         }),
    //                                     )
    //                                         .then(() => {
    //                                             search
    //                                                 .len()
    //                                                 .then((len: number) => {
    //                                                     expect(len).toEqual(55);
    //                                                     finish(session, done);
    //                                                 })
    //                                                 .catch((err: Error) => {
    //                                                     finish(session, done, err);
    //                                                 });
    //                                         })
    //                                         .catch((err: Error) => {
    //                                             finish(session, done, err);
    //                                         });
    //                                 })
    //                                 .catch((err: Error) => {
    //                                     finish(
    //                                         session,
    //                                         done,
    //                                         new Error(
    //                                             `Fail to grab data due error: ${err.message}`,
    //                                         ),
    //                                     );
    //                                 });
    //                         })
    //                         .catch(finish.bind(null, session, done));
    //                 })
    //                 .catch(finish.bind(null, session, done));
    //         })
    //         .catch(finish.bind(null, session, done));
    // });
});
