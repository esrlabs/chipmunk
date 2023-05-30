// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Observe } from '../src/api/session';
import { finish, createSampleFile, appendToSampleFile, runner } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.values;

describe('Values', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true, config.regular.list[1]);
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
                    let sum = 0;
                    const tmpobj = createSampleFile(5000, logger, (i: number) => {
                        if (i % 100 === 0 || i <= 5) {
                            sum += i;
                            return `[${i}]:: some data CPU=${i}% line data\n`;
                        } else {
                            return `[${i}]:: some line data\n`;
                        }
                    });
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text().text())
                        .on('confirmed', () => {
                            search
                                .values([`CPU=(\\d{1,})`])
                                .then((results) => {
                                    expect(valuesAreDropped).toEqual(true);
                                    let control = 0;
                                    results.forEach((values, position) => {
                                        expect(values.size).toEqual(1);
                                        const value = values.get(0);
                                        expect(typeof value).toEqual('string');
                                        const numValue = parseInt(value as string, 10);
                                        control += numValue;
                                        expect(numValue).toEqual(position);
                                    });
                                    expect(control).toEqual(sum);
                                    finish(session, done);
                                })
                                .catch(finish.bind(null, session, done));
                        })
                        .catch(finish.bind(null, session, done));
                    let valuesAreDropped = false;
                    events.SearchValuesUpdated.subscribe((event) => {
                        // Before get results rustcore should inform FE about dropping results.
                        // It happens with NULL value of update
                        expect(event).toBeNull();
                        valuesAreDropped = true;
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
                    session.debug(true, config.regular.list[2]);
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
                    let sum = 0;
                    const tmpobj = createSampleFile(5000, logger, (i: number) => {
                        if (i % 100 === 0 || i <= 5) {
                            sum += i;
                            return `[${i}]:: some data CPU=${i}% line data\n`;
                        } else {
                            return `[${i}]:: some line data\n`;
                        }
                    });
                    let results = new Map();
                    stream
                        .observe(Observe.DataSource.file(tmpobj.name).text().text())
                        .on('confirmed', () => {
                            search
                                .values([`CPU=(\\d{1,})`])
                                .then((res) => {
                                    results = res;
                                    expect(valuesAreDropped).toEqual(true);
                                    let control = 0;
                                    results.forEach((values, position) => {
                                        expect(values.size).toEqual(1);
                                        const value = values.get(0);
                                        expect(typeof value).toEqual('string');
                                        const numValue = parseInt(value as string, 10);
                                        control += numValue;
                                        expect(numValue).toEqual(position);
                                    });
                                    expect(control).toEqual(sum);
                                    const offset = 5000;
                                    appendToSampleFile(tmpobj, 5000, logger, (i: number) => {
                                        if (i % 100 === 0 || i <= 5) {
                                            sum += i + offset;
                                            return `[${i}]:: some data CPU=${
                                                i + offset
                                            }% line data\n`;
                                        } else {
                                            return `[${i}]:: some line data\n`;
                                        }
                                    });
                                })
                                .catch(finish.bind(null, session, done));
                        })
                        .catch(finish.bind(null, session, done));
                    let valuesAreDropped = false;
                    events.SearchValuesUpdated.subscribe((event) => {
                        // Before get results rustcore should inform FE about dropping results.
                        // It happens with NULL value of update
                        if (!valuesAreDropped) {
                            expect(event).toBeNull();
                            valuesAreDropped = true;
                            return;
                        }
                        if (event === null) {
                            expect(event === null).toBe(false);
                            return;
                        }
                        results = new Map([...results].concat([...event.values]));
                        let control = 0;
                        results.forEach((values, position) => {
                            expect(values.size).toEqual(1);
                            const value = values.get(0);
                            expect(typeof value).toEqual('string');
                            const numValue = parseInt(value as string, 10);
                            control += numValue;
                            expect(numValue).toEqual(position);
                        });
                        expect(control).toEqual(sum);
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
});
