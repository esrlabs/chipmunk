// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { GrabbedElement } from 'platform/types/bindings';
import { createSampleFile, finish, relativePath, rootPath } from './common';
import { readConfigurationFile } from './config';
import { fromIndexes } from 'platform/types/range';
import { v4 } from 'uuid';

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as runners from './runners';

const config = readConfigurationFile().get().tests.exporting;

describe('Exporting', function () {
    it(config.regular.list[1], function () {
        return runners.withSession(config.regular, 1, async (logger, done, comps) => {
            let controlSum = 0;
            const ranges = [
                {
                    start: 50,
                    end: 100,
                },
                {
                    start: 200,
                    end: 300,
                },
            ];
            const tmpobj = createSampleFile(1000, logger, (i: number) => {
                ranges.forEach((r) => {
                    if (i >= r.start && i <= r.end) {
                        controlSum += i;
                    }
                });
                return `____${i}____\n`;
            });
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
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 500 || gotten) {
                    return;
                }
                gotten = true;
                const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                comps.stream
                    .export(output, ranges, {
                        columns: [],
                        spliter: undefined,
                        delimiter: undefined,
                    })
                    .then(() => {
                        fs.promises
                            .readFile(output, { encoding: 'utf-8' })
                            .then((content) => {
                                const rows = content
                                    .split('\n')
                                    .map((r) => parseInt(r.replace(/_/gi, ''), 10));
                                const sum = rows.reduce((partialSum, a) => partialSum + a, 0);
                                expect(sum).toEqual(controlSum);
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
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
                            comps.session,
                            done,
                            new Error(
                                `Fail to export data due error: ${
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
            const ranges = [
                {
                    start: 50,
                    end: 90,
                },
                {
                    start: 101,
                    end: 150,
                },
            ];
            let controlSum = 0;
            const tmpobj_a = createSampleFile(100, logger, (i: number) => {
                if (i >= ranges[0].start && i <= ranges[0].end) {
                    controlSum += i;
                }
                return `____${i}____\n`;
            });
            const tmpobj_b = createSampleFile(100, logger, (i: number) => {
                if (i >= ranges[1].start - 100 && i <= ranges[1].end - 100) {
                    controlSum += i * 1000;
                }
                return `____${i * 1000}____\n`;
            });
            comps.stream
                .observe(
                    new Factory.Concat()
                        .type(Factory.FileType.Text)
                        .files([tmpobj_a.name, tmpobj_b.name])
                        .asText()
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 199 || gotten) {
                    return;
                }
                gotten = true;
                const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                comps.stream
                    .export(output, ranges, {
                        columns: [],
                        spliter: undefined,
                        delimiter: undefined,
                    })
                    .then(() => {
                        fs.promises
                            .readFile(output, { encoding: 'utf-8' })
                            .then((content) => {
                                const rows = content
                                    .split('\n')
                                    .map((r) => parseInt(r.replace(/_/gi, ''), 10));
                                const sum = rows.reduce((partialSum, a) => partialSum + a, 0);
                                expect(sum).toEqual(controlSum);
                                finish(comps.session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    comps.session,
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
                            comps.session,
                            done,
                            new Error(
                                `Fail to export data due error: ${
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
                                filter: '__\\d+__',
                                flags: { reg: true, word: false, cases: false },
                            },
                        ])
                        .then((_found) => {
                            const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                            comps.search
                                .grab(range.from, range.to)
                                .then((grabbed: GrabbedElement[]) => {
                                    comps.stream
                                        .export(output, fromIndexes(grabbed.map((el) => el.pos)), {
                                            columns: [],
                                            spliter: undefined,
                                            delimiter: undefined,
                                        })
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
                                                    finish(comps.session, done);
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        comps.session,
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
                                                comps.session,
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
                        .catch(finish.bind(null, comps.session, done));
                })
                .catch(finish.bind(null, comps.session, done));
        });
    });

    it(config.regular.list[4], function () {
        return runners.withSession(config.regular, 4, async (logger, done, comps) => {
            const filename = relativePath(config.regular.files['dlt'][0]);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .file(filename)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 9 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 9)
                    .then((grabbed) => {
                        const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                        comps.stream
                            .export(output, [{ start: 0, end: 8 }], {
                                columns: [],
                                spliter: undefined,
                                delimiter: undefined,
                            })
                            .then(() => {
                                fs.promises
                                    .readFile(output, { encoding: 'utf-8' })
                                    .then((content) => {
                                        const rows = content.split('\n');
                                        expect(rows.length).toEqual(grabbed.length);
                                        for (let i = 0; i < rows.length; i += 1) {
                                            expect(rows[i]).toEqual(grabbed[i].content);
                                            if (rows[i] !== grabbed[i].content) {
                                                return finish(
                                                    comps.session,
                                                    done,
                                                    new Error(
                                                        `Rows are dismatch. Stream position ${grabbed[i].pos}.`,
                                                    ),
                                                );
                                            }
                                        }
                                        finish(comps.session, done);
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                                    comps.session,
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
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
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
            const filename = relativePath(config.regular.files['dlt'][0]);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .file(filename)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 9 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 9)
                    .then((grabbed) => {
                        const output = path.resolve(os.tmpdir(), `${v4()}.dlt`);
                        comps.stream
                            .exportRaw(output, [{ start: 0, end: 8 }])
                            .then(async () => {
                                comps.session
                                    .destroy()
                                    .then(async () => {
                                        const { session, stream, search, events } =
                                            await runners.initializeSession(config.regular.list[5]);
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .type(Factory.FileType.Binary)
                                                    .asDlt({
                                                        fibex_file_paths: [],
                                                        filter_config: undefined,
                                                        with_storage_header: true,
                                                        tz: undefined,
                                                    })
                                                    .file(output)
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        let gotten: boolean = false;
                                        gotten = false;
                                        events.StreamUpdated.subscribe((rows: number) => {
                                            if (rows < 9 || gotten) {
                                                return;
                                            }
                                            gotten = true;
                                            stream
                                                .grab(0, 9)
                                                .then((rows) => {
                                                    expect(rows.length).toEqual(grabbed.length);
                                                    for (let i = 0; i < rows.length; i += 1) {
                                                        expect(rows[i].content).toEqual(
                                                            grabbed[i].content,
                                                        );
                                                        if (
                                                            rows[i].content !== grabbed[i].content
                                                        ) {
                                                            return finish(
                                                                session,
                                                                done,
                                                                new Error(
                                                                    `Rows are dismatch. Stream position ${grabbed[i].pos}.`,
                                                                ),
                                                            );
                                                        }
                                                    }
                                                    finish(session, done);
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
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
                                                `Fail to destroy session due error: ${
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
                                        `Fail to export data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    })
                    .catch((err: Error) => {
                        finish(
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
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
            const filename_a = relativePath(config.regular.files['dlt'][0]);
            const filename_b = relativePath(config.regular.files['dlt'][1]);
            comps.stream
                .observe(
                    new Factory.Concat()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .files([filename_a, filename_b])
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 15 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 15)
                    .then((grabbed) => {
                        expect(grabbed[8].source_id).toEqual(0);
                        expect(grabbed[10].source_id).toEqual(1);
                        const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                        comps.stream
                            .export(output, [{ start: 0, end: 14 }], {
                                columns: [],
                                spliter: undefined,
                                delimiter: undefined,
                            })
                            .then(() => {
                                fs.promises
                                    .readFile(output, { encoding: 'utf-8' })
                                    .then((content) => {
                                        const rows = content.split('\n');
                                        expect(rows.length).toEqual(grabbed.length);
                                        for (let i = 0; i < rows.length; i += 1) {
                                            expect(rows[i]).toEqual(grabbed[i].content);
                                            if (rows[i] !== grabbed[i].content) {
                                                return finish(
                                                    comps.session,
                                                    done,
                                                    new Error(
                                                        `Rows are dismatch. Stream position ${grabbed[i].pos}.`,
                                                    ),
                                                );
                                            }
                                        }
                                        finish(comps.session, done);
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                                    comps.session,
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
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
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
            const filename_a = relativePath(config.regular.files['dlt'][0]);
            const filename_b = relativePath(config.regular.files['dlt'][1]);
            comps.stream
                .observe(
                    new Factory.Concat()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .files([filename_a, filename_b])
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 15 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 15)
                    .then((grabbed) => {
                        expect(grabbed[8].source_id).toEqual(0);
                        expect(grabbed[10].source_id).toEqual(1);
                        const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                        comps.stream
                            .exportRaw(output, [{ start: 0, end: 14 }])
                            .then(() => {
                                comps.session
                                    .destroy()
                                    .then(async () => {
                                        const { session, stream, search, events } =
                                            await runners.initializeSession(config.regular.list[7]);
                                        if (stream instanceof Error) {
                                            finish(session, done, stream);
                                            return;
                                        }
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .type(Factory.FileType.Binary)
                                                    .asDlt({
                                                        fibex_file_paths: [],
                                                        filter_config: undefined,
                                                        with_storage_header: true,
                                                        tz: undefined,
                                                    })
                                                    .file(output)
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        if (events instanceof Error) {
                                            finish(session, done, events);
                                            return;
                                        }
                                        gotten = false;
                                        events.StreamUpdated.subscribe((rows: number) => {
                                            if (rows < 15 || gotten) {
                                                return;
                                            }
                                            gotten = true;
                                            stream
                                                .grab(0, 15)
                                                .then((rows) => {
                                                    expect(rows.length).toEqual(grabbed.length);
                                                    for (let i = 0; i < rows.length; i += 1) {
                                                        expect(rows[i].content).toEqual(
                                                            grabbed[i].content,
                                                        );
                                                        if (
                                                            rows[i].content !== grabbed[i].content
                                                        ) {
                                                            return finish(
                                                                session,
                                                                done,
                                                                new Error(
                                                                    `Rows are dismatch. Stream position ${grabbed[i].pos}.`,
                                                                ),
                                                            );
                                                        }
                                                    }
                                                    finish(session, done);
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
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
                                                `Fail to destroy session due error: ${
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
                                        `Fail to export data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    })
                    .catch((err: Error) => {
                        finish(
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
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
            const filename_a = relativePath(config.regular.files['dlt'][0]);
            const filename_b = relativePath(config.regular.files['dlt'][1]);
            comps.stream
                .observe(
                    new Factory.Concat()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .files([filename_a, filename_b])
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 15 || gotten) {
                    return;
                }
                const ranges = [
                    {
                        start: 0,
                        end: 5,
                    },
                    {
                        start: 9,
                        end: 14,
                    },
                ];
                gotten = true;
                Promise.all(ranges.map((r) => comps.stream.grab(r.start, r.end - r.start)))
                    .then((results) => {
                        let grabbed: GrabbedElement[] = [];
                        results.forEach((g) => (grabbed = grabbed.concat(g)));
                        grabbed.sort((a, b) => (a.pos > b.pos ? 1 : -1));
                        const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                        comps.stream
                            .exportRaw(
                                output,
                                ranges.map((r) => {
                                    return { start: r.start, end: r.end - 1 };
                                }),
                            )
                            .then(() => {
                                comps.session
                                    .destroy()
                                    .then(async () => {
                                        const { session, stream, search, events } =
                                            await runners.initializeSession(config.regular.list[8]);
                                        stream
                                            .observe(
                                                new Factory.File()
                                                    .type(Factory.FileType.Binary)
                                                    .asDlt({
                                                        fibex_file_paths: [],
                                                        filter_config: undefined,
                                                        with_storage_header: true,
                                                        tz: undefined,
                                                    })
                                                    .file(output)
                                                    .get()
                                                    .sterilized(),
                                            )
                                            .catch(finish.bind(null, session, done));
                                        gotten = false;
                                        events.StreamUpdated.subscribe((rows: number) => {
                                            if (rows < 5 || gotten) {
                                                return;
                                            }
                                            gotten = true;
                                            stream
                                                .grab(0, 10)
                                                .then((rows) => {
                                                    expect(rows.length).toEqual(grabbed.length);
                                                    for (let i = 0; i < rows.length; i += 1) {
                                                        expect(rows[i].content).toEqual(
                                                            grabbed[i].content,
                                                        );
                                                        if (
                                                            rows[i].content !== grabbed[i].content
                                                        ) {
                                                            return finish(
                                                                session,
                                                                done,
                                                                new Error(
                                                                    `Rows are dismatch. Stream position ${grabbed[i].pos}.`,
                                                                ),
                                                            );
                                                        }
                                                    }
                                                    finish(session, done);
                                                })
                                                .catch((err: Error) => {
                                                    finish(
                                                        session,
                                                        done,
                                                        new Error(
                                                            `Fail to grab due error: ${
                                                                err instanceof Error
                                                                    ? err.message
                                                                    : err
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
                                                `Fail to destroy session due error: ${
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
                                        `Fail to export data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    })
                    .catch((err: Error) => {
                        finish(
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
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
            const filename = relativePath(config.regular.files['dlt'][0]);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .file(filename)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 9 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 9)
                    .then((grabbed) => {
                        const output = path.resolve(os.tmpdir(), `${v4()}.txt`);
                        comps.stream
                            .export(output, [{ start: 0, end: 8 }], {
                                columns: [0, 1],
                                spliter: '\u0004',
                                delimiter: ';',
                            })
                            .then(async () => {
                                fs.promises
                                    .readFile(output, { encoding: 'utf-8' })
                                    .then((content) => {
                                        const rows = content.split('\n');
                                        expect(rows.length).toEqual(grabbed.length);
                                        for (let i = 0; i < rows.length; i += 1) {
                                            const columns = rows[i].split(';');
                                            const origin = grabbed[i].content.split('\u0004');
                                            expect(columns.length).toEqual(2);
                                            for (let n = 0; n < columns.length; n += 1) {
                                                expect(columns[n]).toEqual(origin[n]);
                                                expect(columns[n].length > 0).toBe(true);
                                            }
                                        }
                                        finish(comps.session, done);
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                                    comps.session,
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
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
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
            const filename = relativePath(config.regular.files['dlt'][0]);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .file(filename)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 9 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 9)
                    .then((grabbed) => {
                        const output = path.resolve(os.tmpdir(), `${v4()}.txt`);
                        comps.stream
                            .export(output, [{ start: 0, end: 8 }], {
                                columns: [9, 10],
                                spliter: '\u0004',
                                delimiter: ';',
                            })
                            .then(async () => {
                                fs.promises
                                    .readFile(output, { encoding: 'utf-8' })
                                    .then((content) => {
                                        const rows = content.split('\n');
                                        expect(rows.length).toEqual(grabbed.length);
                                        for (let i = 0; i < rows.length; i += 1) {
                                            const columns = rows[i].split(';');
                                            const origin = grabbed[i].content.split('\u0004');
                                            expect(columns.length).toEqual(2);
                                            for (let n = 0; n < columns.length; n += 1) {
                                                expect(columns[n]).toEqual(origin[9 + n]);
                                                expect(columns[n].length > 0).toBe(true);
                                            }
                                        }
                                        finish(comps.session, done);
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                                    comps.session,
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
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            ),
                        );
                    });
            });
        });
    });
    it(config.regular.list[11], function () {
        return runners.withSession(config.regular, 11, async (logger, done, comps) => {
            const filename = relativePath(config.regular.files['dlt'][0]);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .file(filename)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 9 || gotten) {
                    return;
                }
                gotten = true;
                comps.stream
                    .grab(0, 9)
                    .then((grabbed) => {
                        const output = path.resolve(os.tmpdir(), `${v4()}.txt`);
                        comps.stream
                            .export(output, [{ start: 0, end: 8 }], {
                                columns: [10],
                                spliter: '\u0004',
                                delimiter: ';',
                            })
                            .then(async () => {
                                fs.promises
                                    .readFile(output, { encoding: 'utf-8' })
                                    .then((content) => {
                                        const rows = content.split('\n');
                                        expect(rows.length).toEqual(grabbed.length);
                                        for (let i = 0; i < rows.length; i += 1) {
                                            const columns = rows[i].split(';');
                                            const origin = grabbed[i].content.split('\u0004');
                                            expect(columns.length).toEqual(1);
                                            for (let n = 0; n < columns.length; n += 1) {
                                                expect(columns[n]).toEqual(origin[10 + n]);
                                                expect(columns[n].length > 0).toBe(true);
                                            }
                                        }
                                        finish(comps.session, done);
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                                    comps.session,
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
                            undefined,
                            done,
                            new Error(
                                `Fail to grab due error: ${
                                    err instanceof Error ? err.message : err
                                }`,
                            ),
                        );
                    });
            });
        });
    });

    it(config.regular.list[12], function () {
        return runners.withSession(config.regular, 12, async (logger, done, comps) => {
            const filename = relativePath(config.regular.files['dlt'][0]);
            comps.stream
                .observe(
                    new Factory.File()
                        .type(Factory.FileType.Binary)
                        .asDlt({
                            fibex_file_paths: [],
                            filter_config: undefined,
                            with_storage_header: true,
                            tz: undefined,
                        })
                        .file(filename)
                        .get()
                        .sterilized(),
                )
                .catch(finish.bind(null, comps.session, done));
            let gotten: boolean = false;
            comps.events.StreamUpdated.subscribe((rows: number) => {
                if (rows < 9 || gotten) {
                    return;
                }
                gotten = true;
                const cases = [
                    {
                        output: path.resolve(os.tmpdir(), `${v4()}.txt`),
                        options: {
                            columns: [],
                            spliter: '\u0004',
                            delimiter: ';',
                        },
                    },
                    {
                        output: path.resolve(os.tmpdir(), `${v4()}.txt`),
                        options: {
                            columns: [0, 1, 2],
                            spliter: undefined,
                            delimiter: ';',
                        },
                    },
                    {
                        output: path.resolve(os.tmpdir(), `${v4()}.txt`),
                        options: {
                            columns: [0, 1, 2],
                            spliter: '\u0004',
                            delimiter: undefined,
                        },
                    },
                    {
                        output: path.resolve(os.tmpdir(), `${v4()}.txt`),
                        options: {
                            columns: [0, 1, 2],
                            spliter: undefined,
                            delimiter: undefined,
                        },
                    },
                    {
                        output: path.resolve(os.tmpdir(), `${v4()}.txt`),
                        options: {
                            columns: [0, 0, 0, 0, 0, 1, 2, 3, 4, 1000000],
                            spliter: '\u0004',
                            delimiter: ';',
                        },
                    },
                ];
                Promise.allSettled(
                    cases.map((usecase) => {
                        const output = usecase.output;
                        return comps.stream
                            .export(output, [{ start: 0, end: 8 }], usecase.options)
                            .then(async () => {
                                fs.promises
                                    .readFile(output, { encoding: 'utf-8' })
                                    .then((content) => {
                                        expect(content.length > 0).toBe(true);
                                    })
                                    .catch((err: Error) => {
                                        finish(
                                            comps.session,
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
                            });
                    }),
                )
                    .then(() => {
                        finish(comps.session, done);
                    })
                    .catch((err) => {
                        finish(comps.session, done, err);
                    });
            });
        });
    });
});
