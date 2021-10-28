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

describe('Errors', function () {
    it('Test 1. Error: Stream len before assign', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Errors. Test 1');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        const len = stream.len();
        expect(len).toEqual(0);
        expect(session.getNativeSession().getStreamLen()).toBeInstanceOf(Error);
        checkSessionDebugger(session);
        finish();
    });

    it('Test 2. Error: Search len before assign', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Errors. Test 2');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const search = session.getSearch();
        if (search instanceof Error) {
            finish(search);
            return;
        }
        const len = search.len();
        expect(len).toEqual(0);
        expect(session.getNativeSession().getSearchLen()).toEqual(0);
        checkSessionDebugger(session);
        finish();
    });

    it('Test 3. Error: search before assign', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Errors. Test 3');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const search = session.getSearch();
        if (search instanceof Error) {
            finish(search);
            return;
        }
        search
            .search([
                {
                    filter: 'match',
                    flags: { reg: true, word: true, cases: false },
                },
            ])
            .then((_) => {
                finish(new Error(`Search should not be available`));
            })
            .catch((err: Error) => {
                finish();
            });
    });

    it('Test 4. Assign fake file', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Errors. Test 4');
        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        stream
            .assign('/fake/path/to/fake/file', {})
            .then(() => {
                finish(new Error(`Not exist file cannot be opened`));
            })
            .catch((err: Error) => {
                expect(err).toBeInstanceOf(Error);
                finish();
            });
    });

    it('Test 5. Assign and grab invalid range', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Errors. Test 5');

        const session = new Session();
        // Set provider into debug mode
        session.debug(true);
        const stream = session.getStream();
        if (stream instanceof Error) {
            finish(stream);
            return;
        }
        const tmpobj = createSampleFile(5000, logger, (i: number) => `some line data: ${i}\n`);
        stream
            .assign(tmpobj.name, {})
            .then(() => {
                // While we do not have operation id
                let result: IGrabbedElement[] | Error = stream.grab(6000, 1000);
                expect(result).toBeInstanceOf(Error);
                finish();
            })
            .catch(finish);
    });

    it('Test 6. Assign & single and grab invalid range', function (done) {
        const finish = (err?: Error) => {
            err !== undefined && fail(err);
            session.destroy();
            checkSessionDebugger(session);
            done();
        };
        const logger = getLogger('Errors. Test 6');
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
                        expect(search.len()).toEqual(55);
                        let result: IGrabbedElement[] | Error = search.grab(6000, 1000);
                        expect(result).toBeInstanceOf(Error);
                        checkSessionDebugger(session);
                        finish();
                    })
                    .catch(finish);
            })
            .catch(finish);
    });
});
