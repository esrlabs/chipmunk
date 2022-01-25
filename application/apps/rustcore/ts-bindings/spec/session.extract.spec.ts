// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { finish, createSampleFile } from './common';
import { getLogger } from '../src/util/logging';

describe('Extract search matches', function () {
    it('Test 1. Assign & single extracting', function (done) {
        const logger = getLogger('Extract. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true, 'Test 1. Assign & single extracting');
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
                        ? `some CPU=${Math.round(Math.random() * 100)}% line data\n`
                        : `some line data\n`
                }`,
        );
        stream
            .observe(tmpobj.name, {})
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
                        search
                            .len()
                            .then((len: number) => {
                                expect(len).toEqual(0);
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(session, done, err);
                            });
                    })
                    .catch(finish.bind(null, session, done));
            })
            .catch(finish.bind(null, session, done));
    });

    it('Test 2. Assign & multiple extracting', function (done) {
        const logger = getLogger('Extract. Test 2');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true, 'Test 2. Assign & multiple extracting');
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
                        ? `some CPU=${Math.round(Math.random() * 100)}% disk=${Math.round(
                              Math.random() * 100,
                          )}% line data\n`
                        : `some line data\n`
                }`,
        );
        stream
            .observe(tmpobj.name, {})
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
                        search
                            .len()
                            .then((len: number) => {
                                expect(len).toEqual(0);
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(session, done, err);
                            });
                    })
                    .catch(finish.bind(null, session, done));
            })
            .catch(finish.bind(null, session, done));
    });

    it('Test 3. Assign & multiple extracting with subgroups extracting', function (done) {
        const logger = getLogger('Extract. Test 3');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true, 'Test 3. Assign & multiple extracting with subgroups extracting');
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
                        ? `some x:${Math.round(Math.random() * 100)},y:${Math.round(
                              Math.random() * 100,
                          )} CPU=${Math.round(Math.random() * 100)}% line data\n`
                        : `some line data\n`
                }`,
        );
        stream
            .observe(tmpobj.name, {})
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
                        search
                            .len()
                            .then((len: number) => {
                                expect(len).toEqual(0);
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(session, done, err);
                            });
                    })
                    .catch(finish.bind(null, session, done));
            })
            .catch(finish.bind(null, session, done));
    });
});
