// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { checkSessionDebugger } from './common';
import { getLogger } from '../src/util/logging';

describe('Extract search matches', function () {
    it('Test 1. Assign & single extracting', function (done) {
        const logger = getLogger('Extract. Test 1');
        function createSampleFile(lines: number) {
            const tmpobj = tmp.fileSync();
            logger.verbose(`Create example grabber file`);
            for (let i = 0; i < lines; i++) {
                fs.appendFileSync(
                    tmpobj.name,
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some CPU=${Math.round(Math.random() * 100)}% line data\n` : `some line data\n`
                    }`,
                );
            }
            var stats = fs.statSync(tmpobj.name);
            logger.verbose(`file-size: ${stats.size}`);
            return tmpobj;
        }

        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        if (search instanceof Error) {
            fail(search);
            return done();
        }

        const tmpobj = createSampleFile(5000);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                const filterA: string = 'cpu=(\\d{1,})';
                search
                    .extract([
                        {
                            filter: filterA,
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then((results) => {
                        expect(search.len()).toEqual(0);
                        expect(results.length).toEqual(55);
                        for (let pos = 0; pos <= 5; pos += 1) {
                            expect(results[pos].position).toEqual(pos);
                        }
                        for (let pos = 1; pos <= 49; pos += 1) {
                            expect(results[pos + 5].position).toEqual(pos * 100);
                        }
                        results.forEach((res) => {
                            expect(res.values.length).toEqual(1);
                            expect(res.values[0].filter.filter).toEqual(filterA);
                        });
                        checkSessionDebugger(session);
                        done();
                    })
                    .catch((err: Error) => {
                        fail(err);
                        done();
                    })
                    .finally(() => {
                        session.destroy();
                    });
            })
            .catch((err: Error) => {
                session.destroy();
                fail(err);
                done();
            });
    });

    it('Test 2. Assign & multiple extracting', function (done) {
        const logger = getLogger('Extract. Test 2');
        function createSampleFile(lines: number) {
            const tmpobj = tmp.fileSync();
            logger.verbose(`Create example grabber file`);
            for (let i = 0; i < lines; i++) {
                fs.appendFileSync(
                    tmpobj.name,
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some CPU=${Math.round(Math.random() * 100)}% disk=${Math.round(Math.random() * 100)}% line data\n` : `some line data\n`
                    }`,
                );
            }
            var stats = fs.statSync(tmpobj.name);
            logger.verbose(`file-size: ${stats.size}`);
            return tmpobj;
        }

        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        if (search instanceof Error) {
            fail(search);
            return done();
        }

        const tmpobj = createSampleFile(5000);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                const filterA: string = 'cpu=(\\d{1,})';
                const filterB: string = 'disk=(\\d{1,})';
                search
                    .extract([
                        {
                            filter: filterA,
                            flags: { reg: true, word: false, cases: false },
                        },
                        {
                            filter: filterB,
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then((results) => {
                        expect(search.len()).toEqual(0);
                        expect(results.length).toEqual(55);
                        for (let pos = 0; pos <= 5; pos += 1) {
                            expect(results[pos].position).toEqual(pos);
                        }
                        for (let pos = 1; pos <= 49; pos += 1) {
                            expect(results[pos + 5].position).toEqual(pos * 100);
                        }
                        results.forEach((res) => {
                            expect(res.values.length).toEqual(2);
                            expect(res.values[0].filter.filter).toEqual(filterA);
                            expect(res.values[1].filter.filter).toEqual(filterB);
                        });
                        checkSessionDebugger(session);
                        done();
                    })
                    .catch((err: Error) => {
                        fail(err);
                        done();
                    })
                    .finally(() => {
                        session.destroy();
                    });
            })
            .catch((err: Error) => {
                session.destroy();
                fail(err);
                done();
            });
    });

    it('Test 3. Assign & multiple extracting with subgroups extracting', function (done) {
        const logger = getLogger('Extract. Test 3');
        function createSampleFile(lines: number) {
            const tmpobj = tmp.fileSync();
            logger.verbose(`Create example grabber file`);
            for (let i = 0; i < lines; i++) {
                fs.appendFileSync(
                    tmpobj.name,
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some x:${Math.round(Math.random() * 100)},y:${Math.round(Math.random() * 100)} CPU=${Math.round(Math.random() * 100)}% line data\n` : `some line data\n`
                    }`,
                );
            }
            var stats = fs.statSync(tmpobj.name);
            logger.verbose(`file-size: ${stats.size}`);
            return tmpobj;
        }

        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        const search = session.getSearch();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        if (search instanceof Error) {
            fail(search);
            return done();
        }

        const tmpobj = createSampleFile(5000);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                const filterA: string = 'cpu=(\\d{1,})';
                const filterB: string = 'x:(\\d{1,}),y:(\\d{1,})';
                search
                    .extract([
                        {
                            filter: filterA,
                            flags: { reg: true, word: false, cases: false },
                        },
                        {
                            filter: filterB,
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then((results) => {
                        expect(search.len()).toEqual(0);
                        expect(results.length).toEqual(55);
                        for (let pos = 0; pos <= 5; pos += 1) {
                            expect(results[pos].position).toEqual(pos);
                        }
                        for (let pos = 1; pos <= 49; pos += 1) {
                            expect(results[pos + 5].position).toEqual(pos * 100);
                        }
                        results.forEach((res) => {
                            expect(res.values.length).toEqual(2);
                            expect(res.values[0].filter.filter).toEqual(filterA);
                            expect(res.values[1].filter.filter).toEqual(filterB);
                            expect(res.values[0].values.length).toEqual(1);
                            expect(res.values[1].values.length).toEqual(2);
                        });
                        checkSessionDebugger(session);
                        done();
                    })
                    .catch((err: Error) => {
                        fail(err);
                        done();
                    })
                    .finally(() => {
                        session.destroy();
                    });
            })
            .catch((err: Error) => {
                session.destroy();
                fail(err);
                done();
            });
    });

});
