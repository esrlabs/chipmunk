// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as os from 'os';

import { Jobs, Tracker } from '../src/index';
import { getLogger } from '../src/util/logging';
import { readConfigurationFile } from './config';
import { finish } from './common';

const config = readConfigurationFile().get().tests.jobs;

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

describe('Jobs', function () {
    it(config.regular.list[1], async function (done) {
        const testName = config.regular.list[1];
        if (ingore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        const jobs = await Jobs.create();
        const tracker = await Tracker.create();
        const operations: Map<string, boolean> = new Map();
        tracker.provider.getEvents().Started.subscribe((event) => {
            operations.set(event.uuid, true);
        });
        tracker.provider.getEvents().Stopped.subscribe((uuid) => {
            operations.set(uuid, false);
        });
        jobs.cancelTest(50, 50)
            .then((a) => {
                // Job is resolved, but not cancelled
                expect(a).toBe(100);
                // Try to cancel job
                const job = jobs
                    .cancelTest(50, 50)
                    .then((_res) => {
                        expect(operations.size).toBe(2);
                        expect(
                            Array.from(operations.values()).filter((running) => running === false)
                                .length,
                        ).toBe(0);
                        finish(
                            [jobs, tracker],
                            done,
                            new Error(`This job should be cancelled, but not done`),
                        );
                    })
                    .canceled(async () => {
                        finish([jobs, tracker], done);
                    })
                    .catch((err: Error) => {
                        finish([jobs, tracker], done, err);
                    });
                job.abort();
            })
            .catch((err: Error) => {
                finish([jobs, tracker], done, err);
            });
    });

    it(config.regular.list[2], async function (done) {
        const testName = config.regular.list[2];
        if (ingore(2, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        const jobs = await Jobs.create();
        // Run 2 jobs with same sequence. One of jobs should be failed, because of sequence
        Promise.allSettled([
            jobs.cancelTest(50, 50, 0).asPromise(),
            jobs.cancelTest(50, 50, 0).asPromise(),
        ])
            .then((res) => {
                if (
                    (res[0].status === 'rejected' && res[1].status === 'rejected') ||
                    (res[0].status !== 'rejected' && res[1].status !== 'rejected')
                ) {
                    finish(jobs, done, new Error(`Only one task should be rejected`));
                }
                expect(
                    res[0].status !== 'rejected'
                        ? res[0].value
                        : res[1].status !== 'rejected'
                        ? res[1].value
                        : undefined,
                ).toBe(100);
                finish(jobs, done);
            })
            .catch((err: Error) => {
                finish(jobs, done, err);
            });
    });

    it(config.regular.list[3], async function (done) {
        const testName = config.regular.list[3];
        if (ingore(3, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        const jobs = await Jobs.create();
        const path = os.homedir();
        jobs.listContent(1, path)
            .then((ls) => {
                expect(typeof ls).toEqual('object');
                const job = jobs
                    .listContent(10, path)
                    .then((_res) => {
                        finish(jobs, done, new Error(`This job should be cancelled, but not done`));
                    })
                    .canceled(async () => {
                        finish(jobs, done);
                    })
                    .catch((err: Error) => {
                        finish(jobs, done, err);
                    });
                job.abort();
            })
            .catch((err: Error) => {
                finish(jobs, done, err);
            });
    });

    it(config.regular.list[4], async function (done) {
        const testName = config.regular.list[4];
        if (ingore(4, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        const jobs = await Jobs.create();
        (async () => {
            try {
                const profiles = await jobs.getShellProfiles();
                expect(profiles.length > 0).toBe(true);
                finish(jobs, done);
                return Promise.resolve();
            } catch (err) {
                return Promise.reject(err instanceof Error ? err : new Error(`${err}`));
            }
        })().catch((err: Error) => {
            finish(
                jobs,
                done,
                new Error(
                    `Fail to finish test due error: ${err instanceof Error ? err.message : err}`,
                ),
            );
        });
    });

    it(config.regular.list[5], async function (done) {
        const testName = config.regular.list[5];
        if (ingore(5, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        const jobs = await Jobs.create();
        (async () => {
            try {
                const envvars = await jobs.getContextEnvvars();
                expect(envvars.size > 0).toBe(true);
                expect(envvars.has('PATH') || envvars.has('path') || envvars.has('Path')).toBe(
                    true,
                );
                finish(jobs, done);
                return Promise.resolve();
            } catch (err) {
                return Promise.reject(err instanceof Error ? err : new Error(`${err}`));
            }
        })().catch((err: Error) => {
            finish(
                jobs,
                done,
                new Error(
                    `Fail to finish test due error: ${err instanceof Error ? err.message : err}`,
                ),
            );
        });
    });
});
