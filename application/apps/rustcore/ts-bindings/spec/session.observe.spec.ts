// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish, performanceReport, setMeasurement } from './common';
import { getLogger } from '../src/util/logging';
import { Config, readConfigurationFile } from './config';

const config: Config | Error = readConfigurationFile(true);

describe('Observe', function () {
    it('Test 1. Observe and grab content (text)', function (done) {
        if (config instanceof Config && config.get().tests.observe.execute_only.length !== 0) {
            if (config.get().tests.observe.execute_only.indexOf(1) === -1) {
                console.log(`Test 1. Observe and grab content (text) is ignored`);
                return done();
            }
        }
        const logger = getLogger('Observe. Test 1');
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, 'Observe. Test 1');
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
                    .observe(Observe.DataSource.asTextFile(tmpobj.name))
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
                                new Error(`Fail to grab data due error: ${err.message}`),
                            );
                        });
                });
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(`Fail to create session due error: ${err.message}`),
                );
            });
    });

    config instanceof Config &&
        it('Test 2. Observe and grab content (pcapng)', function (done) {
            if (config.get().tests.observe.execute_only.length !== 0) {
                if (config.get().tests.observe.execute_only.indexOf(2) === -1) {
                    console.log(`Test 1. Observe and grab content (pcapng) is ignored`);
                    return done();
                }
            }
            const logger = getLogger('Observe. Test 2');
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, 'Observe. Test 2');
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
                            Observe.DataSource.asPcapFile(
                                config.get().tests.observe.regular_test.pcapng,
                                {
                                    dlt: {
                                        filter_config: undefined,
                                        fibex_file_paths: undefined,
                                        with_storage_header: false,
                                    },
                                },
                            ),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows < 100 || grabbing) {
                            return;
                        }
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
                                    new Error(`Fail to grab data due error: ${err.message}`),
                                );
                            });
                    });
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(`Fail to create session due error: ${err.message}`),
                    );
                });
        });

    config instanceof Config &&
        it('Test 3. Observe and grab content (dlt)', function (done) {
            if (config.get().tests.observe.execute_only.length !== 0) {
                if (config.get().tests.observe.execute_only.indexOf(3) === -1) {
                    console.log(`Test 1. Observe and grab content (dlt) is ignored`);
                    return done();
                }
            }
            const logger = getLogger('Observe. Test 2');
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, 'Observe. Test 3');
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
                            Observe.DataSource.asDltFile(
                                config.get().tests.observe.regular_test.dlt,
                                {
                                    filter_config: undefined,
                                    fibex_file_paths: undefined,
                                    with_storage_header: false,
                                },
                            ),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows < 100 || grabbing) {
                            return;
                        }
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
                                    new Error(`Fail to grab data due error: ${err.message}`),
                                );
                            });
                    });
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(`Fail to create session due error: ${err.message}`),
                    );
                });
        });

    config instanceof Config &&
        config.get().tests.observe.performance_test.run &&
        Object.keys(config.get().tests.observe.performance_test.tests).forEach(
            (alias: string, index: number) => {
                const test = (config.get().tests.observe.performance_test.tests as any)[alias];
                const testName = `Performance test #${index + 1} (${test.alias})`;
                if (test.ignore) {
                    console.log(`Test "${testName}" has been ignored`);
                    return;
                }
                it(testName, function (done) {
                    const logger = getLogger(testName);
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
                                        .observe(Observe.DataSource.asTextFile(test.file))
                                        .catch(finish.bind(null, session, done));
                                    break;
                                case 'dlt':
                                    break;
                                case 'pcap':
                                    stream
                                        .observe(
                                            Observe.DataSource.asPcapFile(test.file, {
                                                dlt: {
                                                    filter_config: undefined,
                                                    fibex_file_paths: undefined,
                                                    with_storage_header: false,
                                                },
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
                                new Error(`Fail to create session due error: ${err.message}`),
                            );
                        });
                });
            },
        );
});
