// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { checkSessionDebugger, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Search', function () {
    it('Test 1. Assign & single search', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Search. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            return finish(stream);
        }
        if (search instanceof Error) {
            return finish(search);
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
            .assign(tmpobj.name, {})
            .then(() => {
                // metadata was created
                search
                    .search([
                        {
                            filter: 'match',
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then((_) => {
                        // search results available on rust side
                        expect(search.len()).toEqual(55);
                        search
                            .getMap(54)
                            .then((map) => {
                                logger.verbose(map);
                                let result: IGrabbedElement[] | Error = search.grab(0, 10);
                                if (result instanceof Error) {
                                    return finish(
                                        new Error(`Fail to grab data due error: ${result.message}`),
                                    );
                                }
                                logger.verbose(result);
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
                                logger.debug(
                                    'result of grab was: ' +
                                        result.map((x) => x.content).join('\n'),
                                );
                                [
                                    [10, 5, 5],
                                    [110, 6, 100],
                                    [390, 9, 400],
                                    [600, 11, 600],
                                ].forEach((data) => {
                                    const nearest = search.getNearest(data[0]);
                                    expect(typeof nearest).toEqual('object');
                                    expect((nearest as any).index).toEqual(data[1]);
                                    expect((nearest as any).position).toEqual(data[2]);
                                });
                                finish();
                            })
                            .catch(finish);
                    })
                    .catch(finish);
            })
            .catch(finish);
    });

    it('Test 2. Assign & multiple search', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Search. Test 2');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        if (search instanceof Error) {
            finish(search);
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
            .assign(tmpobj.name, {})
            .then(() => {
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
                    .then(() => {
                        expect(search.len()).toEqual(111);
                        let result: IGrabbedElement[] | Error = search.grab(0, 10);
                        if (result instanceof Error) {
                            return finish(
                                new Error(`Fail to grab data due error: ${result.message}`),
                            );
                        }
                        logger.verbose(result);
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
                            9, // 6
                            50, // 7
                            100, // 8
                            150, // 9
                            200, // 10
                        ]);
                        logger.debug(
                            'result of grab was: ' + result.map((x) => x.content).join('\n'),
                        );
                        [
                            [5, 5, 5],
                            [10, 6, 9],
                            [55, 7, 50],
                            [190, 10, 200],
                        ].forEach((data) => {
                            const nearest = search.getNearest(data[0]);
                            expect(typeof nearest).toEqual('object');
                            expect((nearest as any).index).toEqual(data[1]);
                            expect((nearest as any).position).toEqual(data[2]);
                        });
                        checkSessionDebugger(session);
                        finish();
                    })
                    .catch(finish);
            })
            .catch(finish);
    });

    it('Test 3. Assign & zero search', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Search. Test 3');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        if (search instanceof Error) {
            finish(search);
            return;
        }

        const tmpobj = createSampleFile(5000, logger, (i: number) => `[${i}]:: some line data\n`);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                search
                    .search([
                        {
                            filter: 'not relevant search',
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then(() => {
                        expect(search.len()).toEqual(0);
                        let result: IGrabbedElement[] | Error = search.grab(0, 10);
                        if (result instanceof Error) {
                            return finish(
                                new Error(`Fail to grab data due error: ${result.message}`),
                            );
                        }
                        logger.verbose(result);
                        logger.debug(
                            'result of grab was: ' + result.map((x) => x.content).join('\n'),
                        );
                        checkSessionDebugger(session);
                        finish();
                    })
                    .catch(finish);
            })
            .catch(finish);
    });

    it('Test 4. Assign & single not case sensitive search', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Search. Test 4');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        if (search instanceof Error) {
            finish(search);
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
            .assign(tmpobj.name, {})
            .then(() => {
                // metadata was created
                search
                    .search([
                        {
                            filter: 'match',
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then((_) => {
                        // search results available on rust side
                        expect(search.len()).toEqual(55);
                        search
                            .getMap(54)
                            .then((map) => {
                                logger.verbose(map);
                                let result: IGrabbedElement[] | Error = search.grab(0, 10);
                                if (result instanceof Error) {
                                    return finish(
                                        new Error(`Fail to grab data due error: ${result.message}`),
                                    );
                                }
                                logger.verbose(result);
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
                                logger.debug(
                                    'result of grab was: ' +
                                        result.map((x) => x.content).join('\n'),
                                );
                                [
                                    [10, 5, 5],
                                    [110, 6, 100],
                                    [390, 9, 400],
                                    [600, 11, 600],
                                ].forEach((data) => {
                                    const nearest = search.getNearest(data[0]);
                                    expect(typeof nearest).toEqual('object');
                                    expect((nearest as any).index).toEqual(data[1]);
                                    expect((nearest as any).position).toEqual(data[2]);
                                });
                                checkSessionDebugger(session);
                                finish();
                            })
                            .catch(finish);
                    })
                    .catch(finish);
            })
            .catch(finish);
    });

    it('Test 5. Assign & single word search', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Search. Test 5');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        if (search instanceof Error) {
            finish(search);
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
            .assign(tmpobj.name, {})
            .then(() => {
                // metadata was created
                search
                    .search([
                        {
                            filter: 'match',
                            flags: { reg: true, word: true, cases: false },
                        },
                    ])
                    .then((_) => {
                        // search results available on rust side
                        expect(search.len()).toEqual(55);
                        search
                            .getMap(54)
                            .then((map) => {
                                logger.verbose(map);
                                let result: IGrabbedElement[] | Error = search.grab(0, 10);
                                if (result instanceof Error) {
                                    return finish(
                                        new Error(`Fail to grab data due error: ${result.message}`),
                                    );
                                }
                                logger.verbose(result);
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
                                logger.debug(
                                    'result of grab was: ' +
                                        result.map((x) => x.content).join('\n'),
                                );
                                [
                                    [10, 5, 5],
                                    [110, 6, 100],
                                    [390, 9, 400],
                                    [600, 11, 600],
                                ].forEach((data) => {
                                    const nearest = search.getNearest(data[0]);
                                    expect(typeof nearest).toEqual('object');
                                    expect((nearest as any).index).toEqual(data[1]);
                                    expect((nearest as any).position).toEqual(data[2]);
                                });
                                checkSessionDebugger(session);
                                finish();
                            })
                            .catch(finish);
                    })
                    .catch(finish);
            })
            .catch(finish);
    });
});
