// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { dlt } from '../src/index';
import { finish, } from './common';
import { readConfigurationFile } from './config';
import { Attachment, FtOptions, DltFilterConf } from 'platform/types/parsers/dlt';
import * as tmp from 'tmp';

const config = readConfigurationFile().get().tests.dlt;
const sample = "tests/ft-sample.dlt";

describe('Dlt', function () {
    // Test 1. Scan for attachments
    it(config.regular.list[1], function (done) {
        const testName = config.regular.list[1];
        console.log(`\nStarting: ${testName}`);

        let options: FtOptions = {
            filter_config: undefined,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .then((result) => {
            expect(result.length).toEqual(3);
            {
                let file: Attachment = result[0];
                expect(file.name).toEqual("test1.txt");
                expect(file.size).toEqual(5);
                expect(file.created_date).toEqual("date");
                expect(file.modified_date).toBeUndefined;
                expect(file.messages).toEqual([1, 3, 7]);
                expect(file.chunks).toEqual([[297, 5]]);
            }
            {
                let file: Attachment = result[1];
                expect(file.name).toEqual("test2.txt");
                expect(file.size).toEqual(6);
                expect(file.created_date).toEqual("date");
                expect(file.modified_date).toBeUndefined;
                expect(file.messages).toEqual([2, 4, 8]);
                expect(file.chunks).toEqual([[380, 6]]);
            }
            {
                let file: Attachment = result[2];
                expect(file.name).toEqual("test3.txt");
                expect(file.size).toEqual(7);
                expect(file.created_date).toEqual("date");
                expect(file.modified_date).toBeUndefined;
                expect(file.messages).toEqual([5, 6, 9]);
                expect(file.chunks).toEqual([[579, 7]]);
            }
            done();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on scanning: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 2. Scan for attachments with filter
    it(config.regular.list[2], function (done) {
        const testName = config.regular.list[2];
        console.log(`\nStarting: ${testName}`);

        let filter: DltFilterConf = {
            min_log_level: undefined,
            app_ids: undefined,
            ecu_ids: ["ecu2"],
            context_ids: undefined,
            app_id_count: 0,
            context_id_count: 0,
        };
        let options: FtOptions = {
            filter_config: filter,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .then((result) => {
            expect(result.length).toEqual(1);
            {
                let file: Attachment = result[0];
                expect(file.name).toEqual("test2.txt");
                expect(file.size).toEqual(6);
                expect(file.created_date).toEqual("date");
                expect(file.modified_date).toBeUndefined;
                expect(file.messages).toEqual([1, 2, 3]);
                expect(file.chunks).toEqual([[380, 6]]);
            }
            done();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on scanning: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 3. Scan for attachments canceled
    it(config.regular.list[3], function (done) {
        const testName = config.regular.list[3];
        console.log(`\nStarting: ${testName}`);

        let options: FtOptions = {
            filter_config: undefined,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .canceled(() => {
            done();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on cancel: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        })
        .abort();
    });

    // Test 4. Extract selected attachments
    it(config.regular.list[4], function (done) {
        const testName = config.regular.list[4];
        console.log(`\nStarting: ${testName}`);

        let options: FtOptions = {
            filter_config: undefined,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .then((result) => {
            expect(result.length).toEqual(3);
            const output = tmp.dirSync();
            let files_with_names: [Attachment, string][] = [[result[0], result[0].name], [result[2], result[2].name]];

            dlt.extract(sample, output.name, files_with_names)
            .then((result) => {
                expect(result).toEqual(12);
                done();
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Error on extracting: ${
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
                    `Error on scanning: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 5. Extract selected attachments with filter
    it(config.regular.list[5], function (done) {
        const testName = config.regular.list[5];
        console.log(`\nStarting: ${testName}`);

        let filter: DltFilterConf = {
            min_log_level: undefined,
            app_ids: undefined,
            ecu_ids: ["ecu2"],
            context_ids: undefined,
            app_id_count: 0,
            context_id_count: 0,
        };
        let options: FtOptions = {
            filter_config: filter,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .then((result) => {
            expect(result.length).toEqual(1);
            const output = tmp.dirSync();
            let files_with_names: [Attachment, string][] = [[result[0], result[0].name]];
            
            dlt.extract(sample, output.name, files_with_names)
            .then((result) => {
                expect(result).toEqual(6);
                done();
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Error on extracting: ${
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
                    `Error on scanning: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 6. Extract selected attachments canceled
    it(config.regular.list[6], function (done) {
        const testName = config.regular.list[6];
        console.log(`\nStarting: ${testName}`);

        let options: FtOptions = {
            filter_config: undefined,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .then((result) => {
            expect(result.length).toEqual(3);
            const output = tmp.dirSync();
            let files_with_names: [Attachment, string][] = [[result[0], result[0].name]];

            dlt.extract(sample, output.name, files_with_names)
            .canceled(() => {
                done();
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Error on cancel: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            })
            .abort();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on scanning: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 7. Extract all attachments
    it(config.regular.list[7], function (done) {
        const testName = config.regular.list[7];
        console.log(`\nStarting: ${testName}`);

        let options: FtOptions = {
            filter_config: undefined,
            with_storage_header: true,
        };

        const output = tmp.dirSync();

        dlt.extractAll(sample, output.name, options)
        .then((result) => {
            expect(result).toEqual(18);
            done();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on extracting: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 8. Extract all attachments with filter
    it(config.regular.list[8], function (done) {
        const testName = config.regular.list[8];
        console.log(`\nStarting: ${testName}`);

        let filter: DltFilterConf = {
            min_log_level: undefined,
            app_ids: undefined,
            ecu_ids: ["ecu2"],
            context_ids: undefined,
            app_id_count: 0,
            context_id_count: 0,
        };
        let options: FtOptions = {
            filter_config: filter,
            with_storage_header: true,
        };

        const output = tmp.dirSync();

        dlt.extractAll(sample, output.name, options)
        .then((result) => {
            expect(result).toEqual(6);
            done();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on extracting: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });

    // Test 9. Extract all attachments canceled
    it(config.regular.list[9], function (done) {
        const testName = config.regular.list[9];
        console.log(`\nStarting: ${testName}`);

        let options: FtOptions = {
            filter_config: undefined,
            with_storage_header: true,
        };

        dlt.scan(sample, options)
        .then((result) => {
            expect(result.length).toEqual(3);
            const output = tmp.dirSync();

            dlt.extractAll(sample, output.name, options)
            .canceled(() => {
                done();
            })
            .catch((err: Error) => {
                finish(
                    undefined,
                    done,
                    new Error(
                        `Error on cancel: ${
                            err instanceof Error ? err.message : err
                        }`,
                    ),
                );
            })
            .abort();
        })
        .catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Error on scanning: ${
                        err instanceof Error ? err.message : err
                    }`,
                ),
            );
        });
    });
});