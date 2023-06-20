// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { finish, runner } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.cancel;

describe('Cancel', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
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
    });
    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
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
    it(config.regular.list[3], function () {
        return runner(config.regular, 3, async (logger, done, collector) => {
            if (config.regular.files === undefined || config.regular.files['text'] === undefined) {
                return finish(
                    undefined,
                    done,
                    new Error(`Text file should defined in settings: cancel.regular.files`),
                );
            }
            if (
                config.regular.spec === undefined ||
                config.regular.spec.cancel === undefined ||
                config.regular.spec.cancel[3] === undefined
            ) {
                return finish(
                    undefined,
                    done,
                    new Error(`For test #3 required specification: cancel.regular.spec`),
                );
            }
            const spec = config.regular.spec.cancel[3];
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
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    stream
                        .observe(
                            new Factory.File()
                                .file(config.regular.files['text'])
                                .type(Factory.FileType.Text)
                                .asText().observe.configuration,
                        )
                        .catch(finish.bind(null, session, done));
                    let canceled: number = 0;
                    let started: number = 0;
                    let processed: number = 0;
                    let resolved: number = 0;
                    const errors: Map<number, Error> = new Map();
                    const searches = spec.terms.length;
                    const check_errors = (): boolean => {
                        if (started !== searches) {
                            finish(
                                session,
                                done,
                                new Error(
                                    `Total amount of search-requests ${searches}. Started - ${started}; Expectation: ${searches}`,
                                ),
                            );
                            return false;
                        }
                        if (canceled !== searches - 1) {
                            finish(
                                session,
                                done,
                                new Error(
                                    `Total amount of search-requests ${searches}. Canceled - ${canceled}; Expectation: ${
                                        searches - 1
                                    }`,
                                ),
                            );
                            return false;
                        }
                        if (errors.size !== 0) {
                            errors.forEach((error: Error) => {
                                console.log(`Error: ${error.message}`);
                            });
                            finish(session, done, new Error(`Has errors during searching`));
                            return false;
                        }
                        return true;
                    };
                    const runner = (terms: string[], index: number) => {
                        if (terms.length === 0) {
                            return;
                        }
                        let filter = terms.splice(0, 1)[0];
                        started += 1;
                        let task = search
                            .search([
                                {
                                    filter,
                                    flags: { reg: true, word: false, cases: false },
                                },
                            ])
                            .canceled(() => {
                                console.log(
                                    `-> [..🗑..]\tsearch operation #${index} (${task.uuid()}) is canceled`,
                                );
                                canceled += 1;
                            })
                            .then(() => {
                                console.log(
                                    `-> [..👝..]\tsearch operation #${index} (${task.uuid()}) is resolved`,
                                );
                                resolved += 1;
                            })
                            .catch((err: Error) => {
                                console.log(
                                    `-> [..⚠..]\tsearch operation #${index} (${task.uuid()}) triggers error`,
                                );
                                errors.set(index, err);
                            })
                            .finally(() => {
                                processed += 1;
                                if (processed === searches) {
                                    if (!check_errors()) {
                                        // Failed
                                        return;
                                    }
                                    if (resolved === 0) {
                                        return finish(
                                            session,
                                            done,
                                            new Error(`At least one search should resolved`),
                                        );
                                    }
                                    finish(session, done);
                                }
                            });
                        setTimeout(() => {
                            runner(terms, index + 1);
                        }, spec.interval_ms);
                    };
                    console.log(`Waiting until target file would be indexed.`);
                    events.FileRead.subscribe(() => {
                        runner(spec.terms, 1);
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
    });
});
