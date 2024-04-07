// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { IGrabbedElement } from 'platform/types/content';
import { IAttachmentsUpdatedUpdated } from '../src/api/session.provider';
import { IAttachment } from 'platform/types/content';
import { createSampleFile, finish, performanceReport, setMeasurement, runner } from './common';
import { readConfigurationFile } from './config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
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
                            new Factory.File()
                                .type(Factory.FileType.PcapNG)
                                .file(config.regular.files['pcapng'])
                                .asDlt({
                                    filter_config: undefined,
                                    fibex_file_paths: [],
                                    with_storage_header: false,
                                    tz: undefined,
                                })
                                .get()
                                .sterilized(),
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
                            new Factory.File()
                                .type(Factory.FileType.Binary)
                                .file(config.regular.files['dlt'])
                                .asDlt({
                                    filter_config: undefined,
                                    fibex_file_paths: [],
                                    with_storage_header: true,
                                    tz: undefined,
                                })
                                .get()
                                .sterilized(),
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

    it(config.regular.list[4], function () {
        return runner(config.regular, 4, async (logger, done, collector) => {
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
                            new Factory.File()
                                .type(Factory.FileType.Binary)
                                .file(config.regular.files['attachments'])
                                .asDlt({
                                    filter_config: undefined,
                                    fibex_file_paths: undefined,
                                    with_storage_header: true,
                                    tz: undefined,
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, session, done));
                    let updates: IAttachmentsUpdatedUpdated[] = [];
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 3 attachments. Has been gotten: ${updates.length}`,
                            ),
                        );
                    }, 20000);
                    events.AttachmentsUpdated.subscribe((update: IAttachmentsUpdatedUpdated) => {
                        updates.push(update);
                        if (updates.length >= 3) {
                            clearTimeout(timeout);
                            expect(updates[0].len).toEqual(1);
                            expect(updates[1].len).toEqual(2);
                            expect(updates[2].len).toEqual(3);
                            {
                                let attachment: IAttachment = updates[0].attachment;
                                expect(attachment.name).toEqual('test1.txt');
                                expect(attachment.size).toEqual(5);
                                expect(attachment.ext).toEqual('txt');
                                expect(attachment.mime).toEqual('text/plain');
                                expect(attachment.messages).toEqual([0, 2, 6]);
                                expect(fs.readFileSync(attachment.filepath, 'utf8')).toEqual(
                                    'test1',
                                );
                            }
                            {
                                let attachment: IAttachment = updates[1].attachment;
                                expect(attachment.name).toEqual('test2.txt');
                                expect(attachment.size).toEqual(6);
                                expect(attachment.ext).toEqual('txt');
                                expect(attachment.mime).toEqual('text/plain');
                                expect(attachment.messages).toEqual([1, 3, 7]);
                                expect(fs.readFileSync(attachment.filepath, 'utf8')).toEqual(
                                    'test22',
                                );
                            }
                            {
                                let attachment: IAttachment = updates[2].attachment;
                                expect(attachment.name).toEqual('test3.txt');
                                expect(attachment.size).toEqual(7);
                                expect(attachment.ext).toEqual('txt');
                                expect(attachment.mime).toEqual('text/plain');
                                expect(attachment.messages).toEqual([4, 5, 8]);
                                expect(fs.readFileSync(attachment.filepath, 'utf8')).toEqual(
                                    'test333',
                                );
                            }
                            finish(session, done);
                        }
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

    it(config.regular.list[5], function () {
        return runner(config.regular, 5, async (logger, done, collector) => {
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
                            new Factory.File()
                                .type(Factory.FileType.PcapNG)
                                .file(config.regular.files['someip-pcapng'])
                                .asSomeip({
                                    fibex_file_paths: [],
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        stream
                            .grab(0, 4)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(4);
                                expect(result[0].content.split('\u0004')).toEqual([
                                    'SD',
                                    /* Header */
                                    '65535', // Service-ID
                                    '33024', // Method-ID
                                    '60', // Length-Field
                                    '0', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'Flags: [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
                                ]);
                                expect(result[3].content.split('\u0004')).toEqual([
                                    'RPC',
                                    /* Header */
                                    '123', // Service-ID
                                    '32773', // Method-ID
                                    '16', // Length-Field
                                    '1', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'Bytes: [00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
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

    it(config.regular.list[6], function () {
        return runner(config.regular, 6, async (logger, done, collector) => {
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
                            new Factory.File()
                                .type(Factory.FileType.PcapNG)
                                .file(config.regular.files['someip-pcapng'])
                                .asSomeip({
                                    fibex_file_paths: [config.regular.files['someip-fibex']],
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        stream
                            .grab(0, 4)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(4);
                                expect(result[0].content.split('\u0004')).toEqual([
                                    'SD',
                                    /* Header */
                                    '65535', // Service-ID
                                    '33024', // Method-ID
                                    '60', // Length-Field
                                    '0', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'Flags: [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
                                ]);
                                expect(result[3].content.split('\u0004')).toEqual([
                                    'RPC',
                                    /* Header */
                                    '123', // Service-ID
                                    '32773', // Method-ID
                                    '16', // Length-Field
                                    '1', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'TestService::timeEvent {timestamp(INT64):1683656786973,}',
                                ]);
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

    it(config.regular.list[7], function () {
        return runner(config.regular, 7, async (logger, done, collector) => {
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
                            new Factory.File()
                                .type(Factory.FileType.PcapLegacy)
                                .file(config.regular.files['someip-pcap'])
                                .asSomeip({
                                    fibex_file_paths: [],
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        stream
                            .grab(0, 4)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(4);
                                expect(result[0].content.split('\u0004')).toEqual([
                                    'SD',
                                    /* Header */
                                    '65535', // Service-ID
                                    '33024', // Method-ID
                                    '60', // Length-Field
                                    '0', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'Flags: [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
                                ]);
                                expect(result[3].content.split('\u0004')).toEqual([
                                    'RPC',
                                    /* Header */
                                    '123', // Service-ID
                                    '32773', // Method-ID
                                    '16', // Length-Field
                                    '1', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'Bytes: [00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
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

    it(config.regular.list[8], function () {
        return runner(config.regular, 8, async (logger, done, collector) => {
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
                            new Factory.File()
                                .type(Factory.FileType.PcapLegacy)
                                .file(config.regular.files['someip-pcap'])
                                .asSomeip({
                                    fibex_file_paths: [config.regular.files['someip-fibex']],
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        stream
                            .grab(0, 4)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(4);
                                expect(result[0].content.split('\u0004')).toEqual([
                                    'SD',
                                    /* Header */
                                    '65535', // Service-ID
                                    '33024', // Method-ID
                                    '60', // Length-Field
                                    '0', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'Flags: [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
                                ]);
                                expect(result[3].content.split('\u0004')).toEqual([
                                    'RPC',
                                    /* Header */
                                    '123', // Service-ID
                                    '32773', // Method-ID
                                    '16', // Length-Field
                                    '1', // Client-ID
                                    '0', // Session-ID
                                    '1', // Interface-Version
                                    '2', // Message-Type
                                    '0', // Return-Type
                                    /* Payload */
                                    'TestService::timeEvent {timestamp(INT64):1683656786973,}',
                                ]);
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
        Object.keys(config.regular.execute_only).length > 0 &&
        Object.keys(config.performance.tests).forEach((alias: string, index: number) => {
            const test = (config.performance.tests as any)[alias];
            const testName = `${test.alias}`;
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
                                let home_dir = (process.env as any)['SH_HOME_DIR'];
                                switch (test.open_as) {
                                    case 'text':
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .asText()
                                                    .type(Factory.FileType.Text)
                                                    .file(`${home_dir}/${test.file}`)
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    case 'dlt':
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .type(Factory.FileType.Binary)
                                                    .file(`${home_dir}/${test.file}`)
                                                    .asDlt({
                                                        filter_config: undefined,
                                                        fibex_file_paths: [],
                                                        with_storage_header: true,
                                                        tz: undefined,
                                                    })
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    case 'pcapng':
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .type(Factory.FileType.PcapNG)
                                                    .file(`${home_dir}/${test.file}`)
                                                    .asDlt({
                                                        filter_config: undefined,
                                                        fibex_file_paths: [],
                                                        with_storage_header: false,
                                                        tz: undefined,
                                                    })
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        break;
                                    case 'startup_measurement':
                                        const tmpobj = createSampleFile(
                                            5000,
                                            logger,
                                            (i: number) => `some line data: ${i}\n`,
                                        );
                                        stream
                                            .observe(
                                                new Factory.Stream()
                                                    .asText()
                                                    .process({
                                                        command: `less ${tmpobj.name}`,
                                                        cwd: process.cwd(),
                                                        envs: process.env as { [key: string]: string },
                                                    })
                                                    .get()
                                                    .sterilized(),
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
                                            `${home_dir}/${test.file}`,
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
