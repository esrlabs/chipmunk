// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import * as fs from 'fs';
import { Session, Observe } from '../src/api/session';
import { createTracker, Jobs } from '../src/index';
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
    it(config.regular.list[2], async function (done) {
        const testName = config.regular.list[2];
        console.log(`\nStarting: ${testName}`);
        const tracker = createTracker();
        const path = config.regular.files['path'];
        if (!fs.existsSync(path)) {
            console.log(`Path ${path} doesn't exist, test skipped`);
            done();
            return;
        }
        const jobs = new Jobs();
        await jobs.init();
        jobs.jobListContent(path).then((res) => {
            console.log("listing: " + res);
        })
        await new Promise(r => setTimeout(r, 10));
        await tracker.shutdown();
        done();
    });

    it(config.regular.list[1], async function (done) {
        const testName = config.regular.list[1];
        if (ingore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        const logger = getLogger(testName);
        const jobs = new Jobs();
        await jobs.init();
        jobs.jobCancelTest(50, 50)
            .then((a) => {
                // Job is resolved, but not cancelled
                expect(a).toBe(100);
                // Try to cancel job
                const job = jobs
                    .jobCancelTest(50, 50)
                    .then((_res) => {
                        finish(
                            undefined,
                            done,
                            new Error(`This job should be cancelled, but not done`),
                        );
                    })
                    .canceled(async () => {
                        jobs.destroy()
                            .then(() => {
                                finish(undefined, done);
                            })
                            .catch((err: Error) => {
                                finish(undefined, done, err);
                            });
                    })
                    .catch((err: Error) => {
                        finish(undefined, done, err);
                    });
                job.abort();
            })
            .catch((err: Error) => {
                finish(undefined, done, err);
            });
    });
});
