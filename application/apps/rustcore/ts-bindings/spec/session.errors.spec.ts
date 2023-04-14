// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, SessionStream, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { finish, createSampleFile, runner } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.errors;

describe('Errors', () => {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, 'Test 1. Error: search before observe');
                    const search = session.getSearch();
                    if (search instanceof Error) {
                        return finish(session, done, search);
                    }
                    search
                        .search([
                            {
                                filter: 'match',
                                flags: { reg: true, word: true, cases: false },
                            },
                        ])
                        .then((found: number) =>
                            finish(session, done, new Error('Search should not be available')),
                        )
                        .catch((err: Error) => {
                            logger.debug(`Expected error: ${err.message}`);
                            finish(session, done);
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
    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, 'Test 2. Error: Assign fake file');
                    const stream = session.getStream();
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    stream
                        .observe(Observe.DataSource.file('/fake/path/to/fake/file').text())
                        .then(
                            finish.bind(
                                null,
                                session,
                                done,
                                new Error(`Not exist file cannot be opened`),
                            ),
                        )
                        .catch((err: Error) => {
                            logger.debug(`Expected error: ${err.message}`);
                            finish(session, done);
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

    it(config.regular.list[3], function () {
        return runner(config.regular, 3, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, 'Test 3. Assign and grab invalid range');
                    const stream = session.getStream();
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        return finish(session, done, events);
                    }
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) => `some line data: ${i}\n`,
                    );
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text())
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows === 0 || grabbing) {
                            return;
                        }
                        grabbing = true;
                        // While we do not have operation id
                        stream
                            .grab(6000, 1000)
                            .then((result: IGrabbedElement[]) => {
                                finish(
                                    session,
                                    done,
                                    new Error(`grabber should not return results`),
                                );
                            })
                            .catch((err: Error) => {
                                logger.debug(`Expected error: ${err.message}`);
                                finish(session, done);
                            });
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

    it(config.regular.list[4], function () {
        return runner(config.regular, 4, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, 'Test 4. Assign & single and grab invalid range');
                    const stream: SessionStream = session.getStream();
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        return finish(session, done, events);
                    }
                    const search = session.getSearch();
                    if (search instanceof Error) {
                        return finish(session, done, search);
                    }
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) =>
                            `[${i}]:: ${
                                i % 100 === 0 || i <= 5
                                    ? `some match line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text())
                        .on('confirmed', () => {
                            search
                                .search([
                                    {
                                        filter: 'match',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((found: number) => {
                                    search
                                        .len()
                                        .then((len: number) => {
                                            expect(len).toEqual(55);
                                            search
                                                .grab(6000, 1000)
                                                .then((result: IGrabbedElement[]) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `search grabber should not return results`,
                                                        ),
                                                    );
                                                })
                                                .catch((err: Error) => {
                                                    logger.debug(`Expected error: ${err.message}`);
                                                    finish(session, done);
                                                });
                                        })
                                        .catch((err: Error) => {
                                            finish(session, done, err);
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
                        new Error(
                            `Fail to create session due error: ${
                                err instanceof Error ? err.message : err
                            }`,
                        ),
                    );
                });
        });
    });
    it(config.regular.list[5], function () {
        return runner(config.regular, 5, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, 'Test 5. Grab lines with negative length');
                    const stream: SessionStream = session.getStream();
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    const tmpobj = createSampleFile(
                        5,
                        logger,
                        (i: number) => `some line data: ${i}\n`,
                    );
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text())
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(`Failed to observe file: ${err.message}`),
                            );
                        });
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows === 0 || grabbing) {
                            return;
                        }
                        stream
                            .grab(1, -2)
                            .then((result: IGrabbedElement[]) => {
                                finish(
                                    session,
                                    done,
                                    new Error('Grab from invalid range should not work'),
                                );
                            })
                            .catch((err: Error) => {
                                logger.debug(`Expected error: ${err.message}`);
                                finish(session, done);
                            });
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
    it(config.regular.list[6], function () {
        return runner(config.regular, 6, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    const stream: SessionStream = session.getStream();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    const tmpobj = createSampleFile(
                        5,
                        logger,
                        (i: number) => `some line data: ${i}\n`,
                    );
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text())
                        .catch((err: Error) =>
                            finish(
                                session,
                                done,
                                new Error(`Failed to observe file: ${err.message}`),
                            ),
                        );
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows === 0 || grabbing) {
                            return;
                        }
                        grabbing = true;
                        stream
                            .grab(-1, 2)
                            .then((result: IGrabbedElement[]) =>
                                finish(session, done, new Error('Grab from invalid start worked')),
                            )
                            .catch((err: Error) => {
                                logger.debug(`Expected error: ${err.message}`);
                                finish(session, done);
                            });
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
