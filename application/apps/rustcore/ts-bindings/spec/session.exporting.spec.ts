// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish, performanceReport, setMeasurement } from './common';
import { getLogger } from '../src/util/logging';
import { readConfigurationFile } from './config';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';

const config = readConfigurationFile().get().tests.exporting;

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

describe('Exporting', function () {
    it(config.regular.list[1], function (done) {
        const testName = config.regular.list[1];
        if (ingore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
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
                let controlSum = 0;
                const ranges = [
                    {
                        from: 50,
                        to: 100,
                    },
                    {
                        from: 200,
                        to: 300,
                    },
                ];
                const tmpobj = createSampleFile(1000, logger, (i: number) => {
                    ranges.forEach((r) => {
                        if (i >= r.from && i <= r.to) {
                            controlSum += i;
                        }
                    });
                    return `____${i}____\n`;
                });
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .catch(finish.bind(null, session, done));
                let gotten: boolean = false;
                events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 500 || gotten) {
                        return;
                    }
                    gotten = true;
                    const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                    stream
                        .export(output, ranges)
                        .then(() => {
                            fs.promises
                                .readFile(output, { encoding: 'utf-8' })
                                .then((content) => {
                                    const rows = content
                                        .split('\n')
                                        .map((r) => parseInt(r.replace(/_/gi, ''), 10));
                                    const sum = rows.reduce((partialSum, a) => partialSum + a, 0);
                                    expect(sum).toEqual(controlSum);
                                    finish(session, done);
                                })
                                .catch((err: Error) => {
                                    finish(
                                        session,
                                        done,
                                        new Error(
                                            `Fail to read output file due error: ${
                                                err instanceof Error ? err.message : err
                                            }`,
                                        ),
                                    );
                                })
                                .finally(() => {
                                    fs.unlinkSync(output);
                                });
                        })
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(
                                    `Fail to export data due error: ${
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

    it(config.regular.list[2], function (done) {
        const testName = config.regular.list[2];
        if (ingore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
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
                const ranges = [
                    {
                        from: 50,
                        to: 90,
                    },
                    {
                        from: 101,
                        to: 150,
                    },
                ];
                let controlSum = 0;
                const tmpobj_a = createSampleFile(100, logger, (i: number) => {
                    if (i >= ranges[0].from && i <= ranges[0].to) {
                        controlSum += i;
                    }
                    return `____${i}____\n`;
                });
                const tmpobj_b = createSampleFile(100, logger, (i: number) => {
                    if (i >= ranges[1].from - 100 && i <= ranges[1].to - 100) {
                        controlSum += i * 1000;
                    }
                    return `____${i * 1000}____\n`;
                });
                stream
                    .observe(Observe.DataSource.concat([tmpobj_a.name, tmpobj_b.name]).text())
                    .catch(finish.bind(null, session, done));
                let gotten: boolean = false;
                events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 199 || gotten) {
                        return;
                    }
                    gotten = true;
                    const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                    stream
                        .export(output, ranges)
                        .then(() => {
                            fs.promises
                                .readFile(output, { encoding: 'utf-8' })
                                .then((content) => {
                                    const rows = content
                                        .split('\n')
                                        .map((r) => parseInt(r.replace(/_/gi, ''), 10));
                                    const sum = rows.reduce((partialSum, a) => partialSum + a, 0);
                                    expect(sum).toEqual(controlSum);
                                    finish(session, done);
                                })
                                .catch((err: Error) => {
                                    finish(
                                        session,
                                        done,
                                        new Error(
                                            `Fail to read output file due error: ${
                                                err instanceof Error ? err.message : err
                                            }`,
                                        ),
                                    );
                                })
                                .finally(() => {
                                    fs.unlinkSync(output);
                                });
                        })
                        .catch((err: Error) => {
                            finish(
                                session,
                                done,
                                new Error(
                                    `Fail to export data due error: ${
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

    it(config.regular.list[3], function (done) {
        if (ingore(1, done)) {
            return;
        }
        const logger = getLogger(config.regular.list[3]);
        Session.create()
            .then((session: Session) => {
                // Set provider into debug mode
                session.debug(true, config.regular.list[3]);
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
                let controlSum = 0;
                const range = {
                    from: 0,
                    to: 50,
                };
                let countOfMatches = 0;
                const tmpobj = createSampleFile(5000, logger, (i: number) => {
                    if (i % 100 === 0 || i <= 5) {
                        if (countOfMatches < range.to) {
                            controlSum += i;
                        }
                        countOfMatches += 1;
                    }
                    return `${i % 100 === 0 || i <= 5 ? `_____${i}_____\n` : `some line data\n`}`;
                });
                stream
                    .observe(Observe.DataSource.file(tmpobj.name).text())
                    .on('confirmed', () => {
                        search
                            .search([
                                {
                                    filter: '__\\d+__',
                                    flags: { reg: true, word: false, cases: false },
                                },
                            ])
                            .then((_found) => {
                                const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                                search
                                    .grab(range.from, range.to)
                                    .then((grabbed: IGrabbedElement[]) => {
                                        search
                                            .export(output, [range])
                                            .then((_done) => {
                                                fs.promises
                                                    .readFile(output, { encoding: 'utf-8' })
                                                    .then((content) => {
                                                        const rows = content
                                                            .split('\n')
                                                            .map((r) =>
                                                                parseInt(r.replace(/_/gi, ''), 10),
                                                            );
                                                        expect(grabbed.length).toEqual(rows.length);
                                                        const sum = rows.reduce(
                                                            (partialSum, a) => partialSum + a,
                                                            0,
                                                        );
                                                        expect(sum).toEqual(controlSum);
                                                        finish(session, done);
                                                    })
                                                    .catch((err: Error) => {
                                                        finish(
                                                            session,
                                                            done,
                                                            new Error(
                                                                `Fail to read output file due error: ${
                                                                    err instanceof Error
                                                                        ? err.message
                                                                        : err
                                                                }`,
                                                            ),
                                                        );
                                                    })
                                                    .finally(() => {
                                                        fs.unlinkSync(output);
                                                    });
                                            })
                                            .catch((err: Error) => {
                                                finish(
                                                    session,
                                                    done,
                                                    new Error(
                                                        `Fail to export data due error: ${
                                                            err instanceof Error ? err.message : err
                                                        }`,
                                                    ),
                                                );
                                            });
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
