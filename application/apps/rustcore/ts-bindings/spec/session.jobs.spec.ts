// tslint:disable
// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { initLogger } from './logger';
initLogger();
import { Jobs, Tracker } from '../src/index';
import { readConfigurationFile } from './config';
import { finish } from './common';

import * as runners from './runners';
import * as os from 'os';

const config = readConfigurationFile().get().tests.jobs;

describe('Jobs', function () {
    it(config.regular.list[1], function () {
        return runners.unbound(config.regular, 1, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            const tracker = collector(await Tracker.create()) as Tracker;
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
                                Array.from(operations.values()).filter(
                                    (running) => running === false,
                                ).length,
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
    });

    it(config.regular.list[2], function () {
        return runners.unbound(config.regular, 2, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
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
    });

    it(config.regular.list[3], function () {
        return runners.unbound(config.regular, 3, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            const path = os.homedir();
            jobs.listContent({
                depth: 1,
                max: 100,
                paths: [path],
                include: { files: true, folders: true },
            })
                .then((ls) => {
                    expect(ls instanceof Array).toEqual(true);
                    const job = jobs
                        .listContent({
                            depth: 10,
                            max: 100,
                            paths: [path],
                            include: { files: true, folders: true },
                        })
                        .then((_res) => {
                            finish(
                                jobs,
                                done,
                                new Error(`This job should be cancelled, but not done`),
                            );
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
    });

    it(config.regular.list[4], function () {
        return runners.unbound(config.regular, 4, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            const profiles = await jobs.getShellProfiles();
            expect(profiles.length > 0).toBe(true);
            finish(jobs, done);
        });
    });

    it(config.regular.list[5], function () {
        return runners.unbound(config.regular, 5, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            const envvars = await jobs.getContextEnvvars();
            expect(envvars.size > 0).toBe(true);
            expect(envvars.has('PATH') || envvars.has('path') || envvars.has('Path')).toBe(true);
            finish(jobs, done);
        });
    });

    it(config.regular.list[6], function () {
        return runners.unbound(config.regular, 6, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            const path = config.regular.files['someip-pcapng'];
            // test single source
            jobs.getSomeipStatistic([path])
                .then((statistic) => {
                    expect(statistic.services.length).toEqual(2);
                    {
                        let service = statistic.services[0];
                        expect(service.item.id).toEqual(123);
                        expect(service.item.num).toEqual(22);
                        expect(service.details.length).toEqual(1);
                        expect(service.details[0].id).toEqual(32773);
                        expect(service.details[0].num).toEqual(22);
                    }
                    {
                        let service = statistic.services[1];
                        expect(service.item.id).toEqual(65535);
                        expect(service.item.num).toEqual(33);
                        expect(service.details.length).toEqual(1);
                        expect(service.details[0].id).toEqual(33024);
                        expect(service.details[0].num).toEqual(33);
                    }
                    expect(statistic.messages.length).toEqual(1);
                    {
                        let message = statistic.messages[0];
                        expect(message.item.id).toEqual(2);
                        expect(message.item.num).toEqual(55);
                        expect(message.details.length).toEqual(1);
                        expect(message.details[0].id).toEqual(0);
                        expect(message.details[0].num).toEqual(55);
                    }

                    // test multiple sources
                    jobs.getSomeipStatistic([path, path])
                        .then((statistic) => {
                            expect(statistic.services.length).toEqual(2);
                            {
                                let service = statistic.services[0];
                                expect(service.item.id).toEqual(123);
                                expect(service.item.num).toEqual(44);
                                expect(service.details.length).toEqual(1);
                                expect(service.details[0].id).toEqual(32773);
                                expect(service.details[0].num).toEqual(44);
                            }
                            {
                                let service = statistic.services[1];
                                expect(service.item.id).toEqual(65535);
                                expect(service.item.num).toEqual(66);
                                expect(service.details.length).toEqual(1);
                                expect(service.details[0].id).toEqual(33024);
                                expect(service.details[0].num).toEqual(66);
                            }
                            expect(statistic.messages.length).toEqual(1);
                            {
                                let message = statistic.messages[0];
                                expect(message.item.id).toEqual(2);
                                expect(message.item.num).toEqual(110);
                                expect(message.details.length).toEqual(1);
                                expect(message.details[0].id).toEqual(0);
                                expect(message.details[0].num).toEqual(110);
                            }

                            // test cancel job
                            jobs.getSomeipStatistic([path])
                                .then((_) => {
                                    finish(
                                        jobs,
                                        done,
                                        new Error(`This job should be cancelled, but not done`),
                                    );
                                })
                                .canceled(async () => {
                                    finish(jobs, done);
                                })
                                .catch((err: Error) => {
                                    finish(jobs, done, err);
                                })
                                .abort();
                        })
                        .catch((err: Error) => {
                            finish(jobs, done, err);
                        });
                })
                .catch((err: Error) => {
                    finish(jobs, done, err);
                });
        });
    });

    it(config.regular.list[7], function () {
        return runners.unbound(config.regular, 7, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            const path = config.regular.files['sample-txt'];
            jobs.isFileBinary({
                filePath: path,
            })
                .then((isBinary) => {
                    expect(typeof isBinary).toEqual('boolean');
                    expect(isBinary).toEqual(false);
                    finish(jobs, done);
                })
                .catch((err: Error) => {
                    finish(jobs, done, err);
                });
        });
    });

    it(config.regular.list[8], function () {
        return runners.unbound(config.regular, 8, async (logger, done, collector) => {
            const jobs = collector(await Jobs.create()) as Jobs;
            // Run sleeping, but do not wait for it
            jobs.sleep(6000).then(() => {
                finish(undefined, done, new Error('Get response from destroyed session'));
            });
            setTimeout(() => {
                // Closing session
                jobs.destroy()
                    .then(() => {
                        finish(undefined, done);
                    })
                    .catch((err: Error) => {
                        finish(undefined, done, err);
                    });
            }, 500);
        });
    });
});
