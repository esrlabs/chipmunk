// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish, performanceReport, setMeasurement, runner } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.observe;

describe('Observe', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true);
                    const stream = session.getStream();
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
                        5000,
                        logger,
                        (i: number) => `some line data: ${i}\n`,
                    );
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text().text())
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows === 0 || grabbing) {
                            return;
                        }
                        grabbing = true;
                        stream
                            .grab(500, 7)
                            .then((result: IGrabbedElement[]) => {
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                expect(result.map((i) => i.content)).toEqual([
                                    'some line data: 500',
                                    'some line data: 501',
                                    'some line data: 502',
                                    'some line data: 503',
                                    'some line data: 504',
                                    'some line data: 505',
                                    'some line data: 506',
                                ]);
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
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

    it(config.regular.list[2], function () {
        return runner(config.regular, 2, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true);
                    const stream = session.getStream();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    stream
                        .observe(
                            Observe.DataSource.file(config.regular.files['pcapng']).binary().dlt({
                                filter_config: undefined,
                                fibex_file_paths: undefined,
                                with_storage_header: false,
                            }),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 100 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 100 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        stream
                            .grab(1, 10)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(10);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
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

    it(config.regular.list[3], function () {
        return runner(config.regular, 3, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true);
                    const stream = session.getStream();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    stream
                        .observe(
                            Observe.DataSource.file(config.regular.files['dlt']).binary().dlt({
                                filter_config: undefined,
                                fibex_file_paths: undefined,
                                with_storage_header: true,
                            }),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 100 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 100 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        stream
                            .grab(1, 10)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(10);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
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

    config.performance.run &&
        Object.keys(config.regular.execute_only).length === 0 &&
        Object.keys(config.performance.tests).forEach((alias: string, index: number) => {
            const test = (config.performance.tests as any)[alias];
            const testName = `Performance test #${index + 1} (${test.alias})`;
            if (test.ignore) {
                console.log(`Test "${testName}" has been ignored`);
                return;
            }
            it(testName, function () {
                return runner(
                    {
                        list: { 1: testName },
                        execute_only: [],
                        files: {},
                    },
                    1,
                    async (logger, done, collector) => {
                        const measurement = setMeasurement();
                        Session.create()
                            .then((session: Session) => {
                                // Set provider into debug mode
                                session.debug(true, testName);
                                const stream = session.getStream();
                                if (stream instanceof Error) {
                                    finish(session, done, stream);
                                    return;
                                }
                                const events = session.getEvents();
                                if (events instanceof Error) {
                                    finish(session, done, events);
                                    return;
                                }
                                switch (test.open_as) {
                                    case 'text':
                                        stream
                                            .observe(
                                                Observe.DataSource.file(test.file).text().text(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    case 'dlt':
                                        stream
                                            .observe(
                                                Observe.DataSource.file(test.file).binary().dlt({
                                                    filter_config: undefined,
                                                    fibex_file_paths: undefined,
                                                    with_storage_header: true,
                                                }),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    case 'pcap':
                                        stream
                                            .observe(
                                                Observe.DataSource.file(test.file).binary().dlt({
                                                    filter_config: undefined,
                                                    fibex_file_paths: undefined,
                                                    with_storage_header: false,
                                                }),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    default:
                                        finish(
                                            undefined,
                                            done,
                                            new Error(`Unsupported format: ${test.open_as}`),
                                        );
                                        return;
                                }
                                events.FileRead.subscribe(() => {
                                    const results = measurement();
                                    finish(
                                        session,
                                        done,
                                        performanceReport(
                                            testName,
                                            results.ms,
                                            test.expectation_ms,
                                            test.file,
                                        )
                                            ? undefined
                                            : new Error(`${testName} is fail`),
                                    );
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
                    },
                );
            });
        });
});
