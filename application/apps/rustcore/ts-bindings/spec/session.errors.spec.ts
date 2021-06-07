// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as tmp from 'tmp';
import * as fs from 'fs';

import { Session } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { checkSessionDebugger, isAsyncResearchTest } from './common';

!isAsyncResearchTest() && describe('Errors', function () {
    it('Error: Stream len before assign', function (done) {
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        const len = stream.len();
        expect(len).toEqual(0);
        expect(session.getNativeSession().getStreamLen()).toBeInstanceOf(Error);
        checkSessionDebugger(session);
        done();
    });

    it('Error: Search len before assign', function (done) {
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const search = session.getSearch();
        if (search instanceof Error) {
            fail(search);
            return done();
        }
        const len = search.len();
        expect(len).toEqual(0);
        expect(session.getNativeSession().getSearchLen()).toEqual(0);
        checkSessionDebugger(session);
        done();
    });

    it('Error: search before assign', function (done) {
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const search = session.getSearch();
        if (search instanceof Error) {
            fail(search);
            return done();
        }
        search
            .search([
                {
                    filter: 'match',
                    flags: { reg: true, word: true, cases: false },
                },
            ])
            .then((_) => {
                fail(new Error(`Search should not be available`));
            })
            .catch((err: Error) => {
                done();
            })
            .finally(() => {
                session.destroy();
                checkSessionDebugger(session);
                done();
            });
    });

	it('Assign fake file', function (done) {
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        stream
            .assign('/fake/path/to/fake/file', {})
            .then(() => {
				fail(new Error(`Not exist file cannot be opened`))
            })
            .catch((err: Error) => {
				expect(err).toBeInstanceOf(Error);
            })
            .finally(() => {
                session.destroy();
                checkSessionDebugger(session);
                done();
            });
    });

    it('Assign and grab invalid range', function (done) {
        function createSampleFile(lines: number) {
            const tmpobj = tmp.fileSync();
            console.log(`Create example grabber file`);
            for (let i = 0; i < lines; i++) {
                fs.appendFileSync(tmpobj.name, `some line data: ${i}\n`);
            }
            const stats = fs.statSync(tmpobj.name);
            console.log(`file-size: ${stats.size}`);
            return tmpobj;
        }

        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            fail(stream);
            return done();
        }
        const tmpobj = createSampleFile(5000);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                // While we do not have operation id
                let result: IGrabbedElement[] | Error = stream.grab(6000, 1000);
                expect(result).toBeInstanceOf(Error);
            })
            .catch((err: Error) => {
                fail(err);
            })
            .finally(() => {
                session.destroy();
                checkSessionDebugger(session);
                done();
            });
    });

    it('Assign & single and grab invalid range', function (done) {
        function createSampleFile(lines: number) {
            const tmpobj = tmp.fileSync();
            console.log(`Create example grabber file`);
            for (let i = 0; i < lines; i++) {
                fs.appendFileSync(
                    tmpobj.name,
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some match line data\n` : `some line data\n`
                    }`,
                );
            }
            var stats = fs.statSync(tmpobj.name);
            console.log(`file-size: ${stats.size}`);
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
                // metadata was created
                search
                    .search([
                        {
                            filter: 'match',
                            flags: { reg: true, word: false, cases: false },
                        },
                    ])
                    .then((_) => {
                        expect(search.len()).toEqual(55);
                        let result: IGrabbedElement[] | Error = search.grab(6000, 1000);
                        expect(result).toBeInstanceOf(Error);
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
