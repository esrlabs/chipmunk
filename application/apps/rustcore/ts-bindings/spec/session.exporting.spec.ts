// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Factory } from '../src/api/session';
import { IGrabbedElement } from 'platform/types/content';
import { createSampleFile, finish } from './common';
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
                                .then((grabbed: IGrabbedElement[]) => {
                                    comps.stream
                                        .export(
                                            output,
                                            fromIndexes(grabbed.map((el) => el.position)),
                                            {
                                                columns: [],
                                                spliter: undefined,
                                                delimiter: undefined,
                                            },
                                        )
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

    if (
        config.regular.files['dlt'] === undefined ||
        config.regular.files['dlt'].length < 1 ||
        !fs.existsSync(config.regular.files['dlt'][0])
    ) {
        console.log(
            `"${config.regular.list[4]}" has been ignored - fail to find DLT file for testing`,
        );
        console.log(
            `"${config.regular.list[5]}" has been ignored - fail to find DLT file for testing`,
        );
    } else {
        it(config.regular.list[4], function () {
            return runners.withSession(config.regular, 4, async (logger, done, comps) => {
                const configuration = new Factory.File()
                    .type(Factory.FileType.Binary)
                    .asDlt({
                        fibex_file_paths: [],
                        filter_config: undefined,
                        with_storage_header: true,
                        tz: undefined,
                    })
                    .file(config.regular.files['dlt'][0])
                    .get();
                console.log(configuration);
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
                            .file(config.regular.files['dlt'][0])
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                let gotten: boolean = false;
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 400 || gotten) {
                        return;
                    }
                    gotten = true;
                    comps.stream
                        .grab(100, 100)
                        .then((grabbed) => {
                            const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                            comps.stream
                                .export(output, [{ from: 100, to: 199 }], {
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
                                                    console.log(
                                                        `Rows are dismatch. Stream position ${grabbed[i].position}.`,
                                                    );
                                                    return finish(comps.session, done);
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
                            .file(config.regular.files['dlt'][0])
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                let gotten: boolean = false;
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 400 || gotten) {
                        return;
                    }
                    gotten = true;
                    comps.stream
                        .grab(100, 100)
                        .then((grabbed) => {
                            const output = path.resolve(os.tmpdir(), `${v4()}.dlt`);
                            comps.stream
                                .exportRaw(output, [{ from: 100, to: 199 }])
                                .then(async () => {
                                    comps.session
                                        .destroy()
                                        .then(async () => {
                                            const { session, stream, search, events } =
                                                await runners.initializeSession(
                                                    config.regular.list[5],
                                                );
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
                                                if (rows < 99 || gotten) {
                                                    return;
                                                }
                                                gotten = true;
                                                comps.stream
                                                    .grab(0, 100)
                                                    .then((rows) => {
                                                        expect(rows.length).toEqual(grabbed.length);
                                                        for (let i = 0; i < rows.length; i += 1) {
                                                            expect(rows[i].content).toEqual(
                                                                grabbed[i].content,
                                                            );
                                                            if (
                                                                rows[i].content !==
                                                                grabbed[i].content
                                                            ) {
                                                                console.log(
                                                                    `Rows are dismatch. Stream position ${grabbed[i].position}.`,
                                                                );
                                                                return finish(session, done);
                                                            }
                                                        }
                                                        finish(session, done);
                                                    })
                                                    .catch((err: Error) => {
                                                        finish(
                                                            undefined,
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
    }

    if (
        config.regular.files['dlt'] === undefined ||
        config.regular.files['dlt'].length < 2 ||
        !fs.existsSync(config.regular.files['dlt'][1])
    ) {
        console.log(
            `"${config.regular.list[6]}" has been ignored - fail to find DLT file for testing`,
        );
        console.log(
            `"${config.regular.list[7]}" has been ignored - fail to find DLT file for testing`,
        );
    } else {
        it(config.regular.list[6], function () {
            return runners.withSession(config.regular, 6, async (logger, done, comps) => {
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
                            .files([config.regular.files['dlt'][1], config.regular.files['dlt'][1]])
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                let gotten: boolean = false;
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 200 || gotten) {
                        return;
                    }
                    gotten = true;
                    comps.stream
                        .grab(50, 100)
                        .then((grabbed) => {
                            expect(grabbed[54].source_id).toEqual(0);
                            expect(grabbed[55].source_id).toEqual(1);
                            const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                            comps.stream
                                .export(output, [{ from: 50, to: 149 }], {
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
                                                    console.log(
                                                        `Rows are dismatch. Stream position ${grabbed[i].position}.`,
                                                    );
                                                    return finish(comps.session, done);
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
                            .files([config.regular.files['dlt'][1], config.regular.files['dlt'][1]])
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                let gotten: boolean = false;
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 200 || gotten) {
                        return;
                    }
                    gotten = true;
                    comps.stream
                        .grab(50, 100)
                        .then((grabbed) => {
                            expect(grabbed[54].source_id).toEqual(0);
                            expect(grabbed[55].source_id).toEqual(1);
                            const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                            comps.stream
                                .exportRaw(output, [{ from: 50, to: 149 }])
                                .then(() => {
                                    comps.session
                                        .destroy()
                                        .then(async () => {
                                            const { session, stream, search, events } =
                                                await runners.initializeSession(
                                                    config.regular.list[7],
                                                );
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
                                                if (rows < 90 || gotten) {
                                                    return;
                                                }
                                                gotten = true;
                                                stream
                                                    .grab(0, 100)
                                                    .then((rows) => {
                                                        expect(rows.length).toEqual(grabbed.length);
                                                        for (let i = 0; i < rows.length; i += 1) {
                                                            expect(rows[i].content).toEqual(
                                                                grabbed[i].content,
                                                            );
                                                            if (
                                                                rows[i].content !==
                                                                grabbed[i].content
                                                            ) {
                                                                console.log(
                                                                    `Rows are dismatch. Stream position ${grabbed[i].position}.`,
                                                                );
                                                                return finish(session, done);
                                                            }
                                                        }
                                                        finish(session, done);
                                                    })
                                                    .catch((err: Error) => {
                                                        finish(
                                                            undefined,
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
                            .files([config.regular.files['dlt'][1], config.regular.files['dlt'][1]])
                            .get()
                            .sterilized(),
                    )
                    .catch(finish.bind(null, comps.session, done));
                let gotten: boolean = false;
                comps.events.StreamUpdated.subscribe((rows: number) => {
                    if (rows < 200 || gotten) {
                        return;
                    }
                    const ranges = [
                        {
                            from: 50,
                            to: 60,
                        },
                        {
                            from: 150,
                            to: 160,
                        },
                    ];
                    gotten = true;
                    Promise.all(ranges.map((r) => comps.stream.grab(r.from, r.to - r.from)))
                        .then((results) => {
                            let grabbed: IGrabbedElement[] = [];
                            results.forEach((g) => (grabbed = grabbed.concat(g)));
                            grabbed.sort((a, b) => (a.position > b.position ? 1 : -1));
                            const output = path.resolve(os.tmpdir(), `${v4()}.logs`);
                            comps.stream
                                .exportRaw(
                                    output,
                                    ranges.map((r) => {
                                        return { from: r.from, to: r.to - 1 };
                                    }),
                                )
                                .then(() => {
                                    comps.session
                                        .destroy()
                                        .then(async () => {
                                            const { session, stream, search, events } =
                                                await runners.initializeSession(
                                                    config.regular.list[8],
                                                );
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
                                                if (rows < 20 || gotten) {
                                                    return;
                                                }
                                                gotten = true;
                                                stream
                                                    .grab(0, 20)
                                                    .then((rows) => {
                                                        expect(rows.length).toEqual(grabbed.length);
                                                        for (let i = 0; i < rows.length; i += 1) {
                                                            expect(rows[i].content).toEqual(
                                                                grabbed[i].content,
                                                            );
                                                            if (
                                                                rows[i].content !==
                                                                grabbed[i].content
                                                            ) {
                                                                console.log(
                                                                    `Rows are dismatch. Stream position ${grabbed[i].position}.`,
                                                                );
                                                                return finish(session, done);
                                                            }
                                                        }
                                                        finish(session, done);
                                                    })
                                                    .catch((err: Error) => {
                                                        finish(
                                                            undefined,
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
    }
});
