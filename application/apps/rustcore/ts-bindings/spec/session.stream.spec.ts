// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { GrabbedElement } from 'platform/types/bindings';
import { createSampleFile, finish } from './common';
import { readConfigurationFile } from './config';
import { utils } from 'platform/log';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as runners from './runners';

const config = readConfigurationFile().get().tests.stream;
// ================================== IMPORTANT ==================================
// THIS TEST WILL BE IGNORED ON WINDOWS
// ===============================================================================
if (process.platform === 'win32') {
    console.log(`${'='.repeat(75)}`);
    console.log(`TESTING OF STREAMS (session.stream.spec) are ignored on WINDOWS`);
    console.log(`${'='.repeat(75)}`);
    describe('Stream', function () {
        it('dummy', function (done) {
            done();
        });
    });
} else {
    describe('Stream', function () {
        it(config.regular.list[1], function () {
            return runners.withSession(config.regular, 1, async (logger, done, comps) => {
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );

                comps.stream
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
                    .catch(finish.bind(null, comps.session, done));
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 5000) {
                        return;
                    }
                    comps.stream
                        .grab(500, 7)
                        .then((result: GrabbedElement[]) => {
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
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );
                const lifeCycleEvents: string[] = [];
                comps.stream
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
                    .on('confirmed', () => {
                        lifeCycleEvents.push('confirmed');
                    })
                    .on('processing', () => {
                        lifeCycleEvents.push('processing');
                    })
                    .catch(finish.bind(null, comps.session, done));
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 5000) {
                        return;
                    }
                    expect(lifeCycleEvents).toEqual(['confirmed', 'processing']);
                    finish(comps.session, done);
                });
            });
        });

        it(config.regular.list[3], function () {
            return runners.withSession(config.regular, 3, async (logger, done, comps) => {
                const lifeCycleEvents: string[] = [];
                comps.stream
                    .observe(
                        new Factory.Stream()
                            .asText()
                            .process({
                                command: `some_invalid_command`,
                                cwd: process.cwd(),
                                envs: process.env as { [key: string]: string },
                            })
                            .get()
                            .sterilized(),
                    )
                    .on('confirmed', () => {
                        lifeCycleEvents.push('confirmed');
                    })
                    .on('processing', () => {
                        lifeCycleEvents.push('processing');
                    })
                    .then(() => {
                        finish(comps.session, done, new Error(`Shound not be resolved`));
                    })
                    .catch((err: Error) => {
                        // Event 'processing' should not come, because stream was created (confirmed), but
                        // it cannot be processed as soon as command is invalid
                        expect(lifeCycleEvents).toEqual(['confirmed']);
                        finish(comps.session, done);
                    });
            });
        });

        it(config.regular.list[4], function () {
            return runners.withSession(config.regular, 4, async (logger, done, comps) => {
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );
                comps.stream
                    .observe(
                        new Factory.Stream()
                            .asText()
                            .process({
                                command: `tail --lines=5000 -f ${tmpobj.name}`,
                                cwd: process.cwd(),
                                envs: process.env as { [key: string]: string },
                            })
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                const append = () => {
                    comps.stream
                        .len()
                        .then((len) => {
                            expect(len).toBe(5000);
                            let chunk = [];
                            for (let i = 0; i < 5000; i += 1) {
                                chunk.push(`some line data: ${i}`);
                            }
                            fs.promises
                                .appendFile(tmpobj.name, `${'\n'}${chunk.join(`\n`)}`)
                                .then(() => {
                                    fs.closeSync(tmpobj.fd);
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
                };
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows === 5000) {
                        append();
                        return;
                    }
                    if (rows < 10000) {
                        return;
                    }
                    comps.stream
                        .grab(500, 7)
                        .then((result: GrabbedElement[]) => {
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

        it(config.regular.list[5], function () {
            return runners.withSession(config.regular, 5, async (logger, done, comps) => {
                const tmpobj = createSampleFile(
                    500,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );
                comps.stream
                    .observe(
                        new Factory.Stream()
                            .asText()
                            .process({
                                command: `tail --lines=5000 -f ${tmpobj.name}`,
                                cwd: process.cwd(),
                                envs: process.env as { [key: string]: string },
                            })
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                const filter = 'match A';
                let expectedMatchesCount = 0;
                const append = () => {
                    comps.stream
                        .len()
                        .then((len) => {
                            expect(len).toBe(500);
                            let chunk = [];
                            for (let i = 0; i < 500; i += 1) {
                                chunk.push(
                                    `some line data ${((n) => {
                                        if (n % 10 === 0) {
                                            expectedMatchesCount += 1;
                                            return filter;
                                        }
                                        return '';
                                    })(i)}: ${i}`,
                                );
                            }
                            fs.promises
                                .appendFile(tmpobj.name, `${'\n'}${chunk.join(`\n`)}`)
                                .then(() => {
                                    fs.closeSync(tmpobj.fd);
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
                };
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows === 500) {
                        comps.search
                            .search([
                                {
                                    filter,
                                    flags: { reg: true, word: false, cases: false, invert: false },
                                },
                            ])
                            .then(() => {
                                // We are appending new data only after search was done to make sure,
                                // updated search results will come
                                append();
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
                                    done,
                                    new Error(
                                        `Fail to search due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                        return;
                    }
                });
                comps.events.SearchUpdated.subscribe((updated) => {
                    if (updated.found <= 0) {
                        return;
                    }
                    expect(updated.found).toBe(expectedMatchesCount);
                    finish(comps.session, done);
                });
            });
        });

        it(config.regular.list[6], function () {
            return runners.withSession(config.regular, 6, async (logger, done, comps) => {
                const tmpobj = createSampleFile(
                    5000,
                    logger,
                    (i: number) => `some line data: ${i}\n`,
                );
                const tailing = comps.stream
                    .observe(
                        new Factory.Stream()
                            .asText()
                            .process({
                                command: `tail --lines=5000 -f ${tmpobj.name}`,
                                cwd: process.cwd(),
                                envs: process.env as { [key: string]: string },
                            })
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 5000) {
                        return;
                    }
                    tailing
                        .canceled(() => {
                            finish(comps.session, done);
                        })
                        .abort();
                });
            });
        });

        it(config.regular.list[7], function () {
            return runners.withSession(config.regular, 7, async (logger, done, comps) => {
                const filename = path.join(os.tmpdir(), 'chipmunk_test_file.log');
                // Create or overwrite file
                fs.writeFileSync(filename, '');
                let ready = 0;
                const TEST_LINES = ['test A', 'test B'];
                const procceed = async () => {
                    ready += 1;
                    if (ready < 2) {
                        return;
                    }
                    try {
                        // Send first message
                        await comps.stream.sde(sed.uuid(), { WriteText: `${TEST_LINES[0]}\n` });
                        // Send second message
                        await comps.stream.sde(sed.uuid(), { WriteText: `${TEST_LINES[1]}\n` });
                    } catch (e) {
                        finish(comps.session, done, new Error(utils.error(e)));
                    }
                };
                const sed = comps.stream
                    .observe(
                        new Factory.Stream()
                            .asText()
                            .process({
                                command: `sed -u "w ${filename}"`,
                                cwd: process.cwd(),
                                envs: process.env as { [key: string]: string },
                            })
                            .get()
                            .sterilized(),
                    )
                    .on('processing', (e) => {
                        procceed();
                    })
                    .catch(finish.bind(null, comps.session, done));
                // Tail file
                const _tail = comps.stream
                    .observe(
                        new Factory.Stream()
                            .asText()
                            .process({
                                command: `tail -f ${filename}`,
                                cwd: process.cwd(),
                                envs: process.env as { [key: string]: string },
                            })
                            .get()
                            .sterilized(),
                    )
                    .on('processing', () => {
                        procceed();
                    })
                    .catch(finish.bind(null, comps.session, done));
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 4) {
                        return;
                    }
                    comps.stream
                        .grab(0, 4)
                        .then((result: GrabbedElement[]) => {
                            logger.debug('result of grab was: ' + JSON.stringify(result));
                            expect(
                                result
                                    .map((i) => i.source_id)
                                    .reduce((partialSum, a) => partialSum + a, 0),
                            ).toBe(2);
                            expect(result.map((i) => i.pos)).toEqual([0, 1, 2, 3]);
                            expect(result.filter((i) => i.content === TEST_LINES[0]).length).toBe(
                                2,
                            );
                            expect(result.filter((i) => i.content === TEST_LINES[1]).length).toBe(
                                2,
                            );
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
}
