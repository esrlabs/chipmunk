// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { finish } from './common';

describe('Cancel', function () {
    it('Test 1. Cancel operation before done', function (done) {
        const session = new Session();
        session.debug(true, 'Test 1. Cancel operation before done');
        let sleep = session
            .sleep(2000)
            .then((results) => {
                finish(session, done, new Error(`Operation isn't canceled`));
            })
            .catch((err: Error) => {
                finish(session, done, err);
            })
            .canceled((reason) => {
                finish(session, done);
            });
        setTimeout(() => {
            sleep.abort();
        }, 250);
    });
    it('Test 2. Cancel operation after done', function (done) {
        const session = new Session();
        session.debug(true, 'Test 2. Cancel operation after done');
        let sleep = session
            .sleep(250)
            .then((results) => {
                finish(session, done);
            })
            .catch((err: Error) => {
                finish(session, done, err);
            })
            .canceled((reason) => {
                finish(session, done, new Error(`Operation cannot be canceled`));
            });
        setTimeout(() => {
            sleep.abort();
        }, 1000);
    });
});
