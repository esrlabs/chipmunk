// tslint:disable
import { initLogger } from './logger';
initLogger();
import { Session, SessionStream, Factory } from '../src/api/session';
import { IGrabbedElement } from 'platform/types/content';
import { finish, createSampleFile, runner } from './common';
import { readConfigurationFile } from './config';
import { error } from 'platform/log/utils';

const config = readConfigurationFile().get().tests.errors;

describe('Errors', () => {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[1]);
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
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });
    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[2]);
                    const stream = session.getStream();
                    if (stream instanceof Error) {
                        return finish(session, done, stream);
                    }
                    stream
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Text)
                                .asText()
                                .file('/fake/path/to/fake/file')
                                .get()
                                .sterilized(),
                        )
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
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[3], function () {
        return runner(config.regular, 3, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[3]);
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
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Text)
                                .asText()
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
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
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[4], function () {
        return runner(config.regular, 4, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[4]);
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
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Text)
                                .asText()
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
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
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });
    it(config.regular.list[5], function () {
        return runner(config.regular, 5, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[5]);
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
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Text)
                                .asText()
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
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
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });
    it(config.regular.list[6], function () {
        return runner(config.regular, 6, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[6]);
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
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Text)
                                .asText()
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
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
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[7], function () {
        return runner(config.regular, 7, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[7]);
                    session.getEvents().SessionDestroyed.subscribe(() => {
                        finish(undefined, done);
                    });
                    session
                        .getNativeSession()
                        .triggerStateError()
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(`Fail to trigger state error due error: ${error(err)}`),
                            );
                        });
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[8], function () {
        return runner(config.regular, 8, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[8]);
                    session.getEvents().SessionDestroyed.subscribe(() => {
                        finish(undefined, done);
                    });
                    session
                        .getNativeSession()
                        .triggerTrackerError()
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(`Fail to trigger tracker error due error: ${error(err)}`),
                            );
                        });
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[9], function () {
        return runner(config.regular, 9, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    session.debug(true, config.regular.list[9]);
                    session
                        .sleep(10000, true)
                        .then(() => {
                            finish(session, done, new Error(`Sleeping task should not finish.`));
                        })
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(`Fail to start sleeping task: ${err.message}`),
                            );
                        });
                    setTimeout(() => {
                        session
                            .destroy()
                            .then(() => {
                                finish(undefined, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    session,
                                    done,
                                    new Error(`Fail to destroy session: ${err.message}`),
                                );
                            });
                    }, 500);
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(`Fail to create session due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[10], function () {
        return runner(config.regular, 10, async (logger, done, _collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[10]);
                    const stream = session.getStream();
                    const search = session.getSearch();
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
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
                                i % 100 === 0 || i <= 5
                                    ? `some match line data\n`
                                    : `some line data\n`
                            }`,
                    );
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name)
                                .get()
                                .sterilized(),
                        )
                        .on('processing', () => {
                            search
                                .search([
                                    {
                                        filter: 'invalid search { condition',
                                        flags: { reg: true, word: false, cases: false },
                                    },
                                ])
                                .then((_) => {
                                    finish(session, done, new Error(`Search should be failed`));
                                })
                                .catch((_err: Error) => {
                                    finish(session, done);
                                });
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
});
