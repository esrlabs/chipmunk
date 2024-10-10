// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { IGrabbedElement } from 'platform/types/content';
import { IAttachmentsUpdatedUpdated } from '../src/api/session.provider';
import { IAttachment } from 'platform/types/content';
import { createSampleFile, finish } from './common';
import { readConfigurationFile } from './config';

import * as fs from 'fs';
import * as runners from './runners';

const config = readConfigurationFile().get().tests.observe;

describe('Observe', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
                    const tmpobj = createSampleFile(
                        5000,
                        logger,
                        (i: number) => `some line data: ${i}\n`,
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        if (rows === 0 || grabbing) {
                            return;
                        }
                        grabbing = true;
                        comps.stream
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
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[2], function () {
        return runners.withSession(config.regular, 2, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 100 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 100 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
                            .grab(1, 10)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(10);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[3], function () {
        return runners.withSession(config.regular, 3, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 100 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 100 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
                            .grab(1, 10)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(10);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[4], function () {
        return runners.withSession(config.regular, 4, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let updates: IAttachmentsUpdatedUpdated[] = [];
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 3 attachments. Has been gotten: ${updates.length}`,
                            ),
                        );
                    }, 20000);
                    comps.events.AttachmentsUpdated.subscribe((update: IAttachmentsUpdatedUpdated) => {
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
                            finish(comps.session, done);
                        }
                    });
        });
    });

    it(config.regular.list[5], function () {
        return runners.withSession(config.regular, 5, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
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
                                    'Flags [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
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
                                    '[00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[6], function () {
        return runners.withSession(config.regular, 6, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
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
                                    'Flags [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
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
                                    'TestService::timeEvent {\u0006\ttimestamp (INT64) : 1683656786973,\u0006}',
                                ]);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[7], function () {
        return runners.withSession(config.regular, 7, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
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
                                    'Flags [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
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
                                    '[00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[8], function () {
        return runners.withSession(config.regular, 8, async (logger, done, comps) => {
                    comps.stream
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
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 55 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
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
                                    'Flags [C0], Offer 123 v1.0 Inst 1 Ttl 3 UDP 192.168.178.58:30000 TCP 192.168.178.58:30000',
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
                                    'TestService::timeEvent {\u0006\ttimestamp (INT64) : 1683656786973,\u0006}',
                                ]);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[9], function () {
        return runners.withSession(config.regular, 9, async (logger, done, comps) => {
                    comps.stream
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Binary)
                                .file(config.regular.files['someip-dlt'])
                                .asDlt({
                                    filter_config: undefined,
                                    fibex_file_paths: [],
                                    with_storage_header: true,
                                    tz: undefined,
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 6 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
                            .grab(0, 6)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(6);
                                expect(result[0].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '204', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP 0.0.0.0:0 >> INST:1 RPC SERV:123 METH:32773 LENG:16 CLID:0 SEID:58252 IVER:1 MSTP:2 RETC:0 [00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                expect(result[5].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '209', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP \'Parse error: Not enough data: min: 25, actual: 24\' [00, 7B, 80, 05, 00, 00, 00, 11, 00, 00, E3, 8C, 01, 01, 02, 00, 00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });

    it(config.regular.list[10], function () {
        return runners.withSession(config.regular, 10, async (logger, done, comps) => {
                    comps.stream
                        .observe(
                            new Factory.File()
                                .type(Factory.FileType.Binary)
                                .file(config.regular.files['someip-dlt'])
                                .asDlt({
                                    filter_config: undefined,
                                    fibex_file_paths: [config.regular.files['someip-fibex']],
                                    with_storage_header: true,
                                    tz: undefined,
                                })
                                .get()
                                .sterilized(),
                        )
                        .catch(finish.bind(null, comps.session, done));
                    let grabbing: boolean = false;
                    let received: number = 0;
                    const timeout = setTimeout(() => {
                        finish(
                            comps.session,
                            done,
                            new Error(
                                `Failed because timeout. Waited for at least 55 rows. Has been gotten: ${received}`,
                            ),
                        );
                    }, 20000);
                    comps.events.StreamUpdated.subscribe((rows: number) => {
                        received = rows;
                        if (rows < 6 || grabbing) {
                            return;
                        }
                        clearTimeout(timeout);
                        grabbing = true;
                        comps.stream
                            .grab(0, 6)
                            .then((result: IGrabbedElement[]) => {
                                expect(result.length).toEqual(6);
                                expect(result[0].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '204', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP 0.0.0.0:0 >> INST:1 RPC SERV:123 METH:32773 LENG:16 CLID:0 SEID:58252 IVER:1 MSTP:2 RETC:0 TestService::timeEvent {\u0006\ttimestamp (INT64) : 1683656786973,\u0006}',
                                ]);
                                expect(result[1].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '205', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP 0.0.0.0:0 >> INST:1 RPC SERV:124 METH:32773 LENG:16 CLID:0 SEID:58252 IVER:1 MSTP:2 RETC:0 UnknownService [00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                expect(result[2].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '206', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP 0.0.0.0:0 >> INST:1 RPC SERV:123 METH:32773 LENG:16 CLID:0 SEID:58252 IVER:3 MSTP:2 RETC:0 TestService<1?>::timeEvent {\u0006\ttimestamp (INT64) : 1683656786973,\u0006}',
                                ]);
                                expect(result[3].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '207', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP 0.0.0.0:0 >> INST:1 RPC SERV:123 METH:32774 LENG:16 CLID:0 SEID:58252 IVER:1 MSTP:2 RETC:0 TestService::UnknownMethod [00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                expect(result[4].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '208', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP 0.0.0.0:0 >> INST:1 RPC SERV:123 METH:32773 LENG:15 CLID:0 SEID:58252 IVER:1 MSTP:2 RETC:0 TestService::timeEvent \'SOME/IP Error: Parser exhausted at offset 0 for Object size 8\' [00, 00, 01, 88, 01, C3, C4]',
                                ]);
                                expect(result[5].content.split('\u0004')).toEqual([
                                    '2024-02-20T13:17:26.713537000Z', 'ECU1', '1', '571', '209', '28138506', 'ECU1', 'APP1', 'C1', 'IPC',
                                    'SOME/IP \'Parse error: Not enough data: min: 25, actual: 24\' [00, 7B, 80, 05, 00, 00, 00, 11, 00, 00, E3, 8C, 01, 01, 02, 00, 00, 00, 01, 88, 01, C3, C4, 1D]',
                                ]);
                                logger.debug('result of grab was: ' + JSON.stringify(result));
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
        });
    });
});
