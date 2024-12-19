// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { GrabbedElement } from 'platform/types/bindings';
import { finish, createSampleFile } from './common';
import { readConfigurationFile } from './config';
import { error } from 'platform/log/utils';

import * as runners from './runners';

const config = readConfigurationFile().get().tests.errors;

describe('Errors', () => {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            comps.search
                .search([
                    {
                        filter: 'match',
                        flags: { reg: true, word: true, cases: false },
                    },
                ])
                .then((_found: number) =>
                    finish(comps.session, done, new Error('Search should not be available')),
                )
                .catch((err: Error) => {
                    logger.debug(`Expected error: ${err.message}`);
                    finish(comps.session, done);
                });
        });
    });
    it(config.regular.list[2], function () {
        return runners.withSession(config.regular, 2, async (logger, done, comps) => {
            comps.stream
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
                        comps.session,
                        done,
                        new Error(`Not exist file cannot be opened`),
                    ),
                )
                .catch((err: Error) => {
                    logger.debug(`Expected error: ${err.message}`);
                    finish(comps.session, done);
                });
        });
    });

    it(config.regular.list[3], function () {
        return runners.withSession(config.regular, 3, async (logger, done, comps) => {
            const tmpobj = createSampleFile(5000, logger, (i: number) => `some line data: ${i}\n`);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Text)
                        .asText()
                        .file(tmpobj.name)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let grabbing: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows === 0 || grabbing) {
                    return;
                }
                grabbing = true;
                // While we do not have operation id
                comps.stream
                    .grab(6000, 1000)
                    .then((_result: GrabbedElement[]) => {
                        finish(comps.session, done, new Error(`grabber should not return results`));
                    })
                    .catch((err: Error) => {
                        logger.debug(`Expected error: ${err.message}`);
                        finish(comps.session, done);
                    });
            });
        });
    });

    it(config.regular.list[4], function () {
        return runners.withSession(config.regular, 4, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) =>
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some match line data\n` : `some line data\n`
                    }`,
            );
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Text)
                        .asText()
                        .file(tmpobj.name)
                        .get()
                        .sterilized(),
                )
                .on('processing', () => {
                    comps.search
                        .search([
                            {
                                filter: 'match',
                                flags: { reg: true, word: false, cases: false },
                            },
                        ])
                        .then((found: number) => {
                            comps.search
                                .len()
                                .then((len: number) => {
                                    expect(len).toEqual(55);
                                    comps.search
                                        .grab(6000, 1000)
                                        .then((result: GrabbedElement[]) => {
                                            finish(
                                                comps.session,
                                                done,
                                                new Error(
                                                    `search grabber should not return results`,
                                                ),
                                            );
                                        })
                                        .catch((err: Error) => {
                                            logger.debug(`Expected error: ${err.message}`);
                                            finish(comps.session, done);
                                        });
                                })
                                .catch((err: Error) => {
                                    finish(comps.session, done, err);
                                });
                        })
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
        });
    });
    it(config.regular.list[5], function () {
        return runners.withSession(config.regular, 5, async (logger, done, comps) => {
            const tmpobj = createSampleFile(5, logger, (i: number) => `some line data: ${i}\n`);
            comps.stream
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
                        comps.session,
                        done,
                        new Error(`Failed to observe file: ${err.message}`),
                    );
                });
            let grabbing: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows === 0 || grabbing) {
                    return;
                }
                comps.stream
                    .grab(1, -2)
                    .then((_result: GrabbedElement[]) => {
                        finish(
                            comps.session,
                            done,
                            new Error('Grab from invalid range should not work'),
                        );
                    })
                    .catch((err: Error) => {
                        logger.debug(`Expected error: ${err.message}`);
                        finish(comps.session, done);
                    });
            });
        });
    });
    it(config.regular.list[6], function () {
        return runners.withSession(config.regular, 6, async (logger, done, comps) => {
            const tmpobj = createSampleFile(5, logger, (i: number) => `some line data: ${i}\n`);
            comps.stream
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
                        comps.session,
                        done,
                        new Error(`Failed to observe file: ${err.message}`),
                    ),
                );
            let grabbing: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows === 0 || grabbing) {
                    return;
                }
                grabbing = true;
                comps.stream
                    .grab(-1, 2)
                    .then((_result: GrabbedElement[]) =>
                        finish(comps.session, done, new Error('Grab from invalid start worked')),
                    )
                    .catch((err: Error) => {
                        logger.debug(`Expected error: ${err.message}`);
                        finish(comps.session, done);
                    });
            });
        });
    });

    it(config.regular.list[7], function () {
        return runners.withSession(config.regular, 7, async (logger, done, comps) => {
            comps.events.SessionDestroyed.subscribe(() => {
                finish(undefined, done);
            });
            comps.session
                .getNativeSession()
                .triggerStateError()
                .catch((err: Error) => {
                    finish(
                        comps.session,
                        done,
                        new Error(`Fail to trigger state error due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[8], function () {
        return runners.withSession(config.regular, 8, async (logger, done, comps) => {
            comps.events.SessionDestroyed.subscribe(() => {
                finish(undefined, done);
            });
            comps.session
                .getNativeSession()
                .triggerTrackerError()
                .catch((err: Error) => {
                    finish(
                        comps.session,
                        done,
                        new Error(`Fail to trigger tracker error due error: ${error(err)}`),
                    );
                });
        });
    });

    it(config.regular.list[9], function () {
        return runners.withSession(config.regular, 9, async (logger, done, comps) => {
            comps.session
                .sleep(10000, true)
                .then(() => {
                    finish(comps.session, done, new Error(`Sleeping task should not finish.`));
                })
                .catch((err: Error) => {
                    finish(
                        comps.session,
                        done,
                        new Error(`Fail to start sleeping task: ${err.message}`),
                    );
                });
            setTimeout(() => {
                comps.session
                    .destroy()
                    .then(() => {
                        finish(undefined, done);
                    })
                    .catch((err: Error) => {
                        finish(
                            comps.session,
                            done,
                            new Error(`Fail to destroy session: ${err.message}`),
                        );
                    });
            }, 500);
        });
    });

    it(config.regular.list[10], function () {
        return runners.withSession(config.regular, 10, async (logger, done, comps) => {
            const tmpobj = createSampleFile(
                5000,
                logger,
                (i: number) =>
                    `[${i}]:: ${
                        i % 100 === 0 || i <= 5 ? `some match line data\n` : `some line data\n`
                    }`,
            );
            comps.stream
                .observe(
                    new Factory.File()
                        .asText()
                        .type(Factory.FileType.Text)
                        .file(tmpobj.name)
                        .get()
                        .sterilized(),
                )
                .on('processing', () => {
                    comps.search
                        .search([
                            {
                                filter: 'invalid search { condition',
                                flags: { reg: true, word: false, cases: false },
                            },
                        ])
                        .then((_) => {
                            finish(comps.session, done, new Error(`Search should be failed`));
                        })
                        .catch((_err: Error) => {
                            finish(comps.session, done);
                        });
                })
                .catch(finish.bind(null, comps.session, done));
        });
    });
});
