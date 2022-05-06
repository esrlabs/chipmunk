// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';
import { finish } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.cancel;

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

describe('Cancel', function () {
    it(config.regular.list[1], function (done) {
        if (ingore(1, done)) {
            return;
        }
        Session.create()
            .then((session: Session) => {
                session.debug(true, config.regular.list[1]);
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
        Session.create()
            .then((session: Session) => {
                session.debug(true, config.regular.list[2]);
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
