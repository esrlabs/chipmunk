// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session, Observe } from '../src/api/session';
import { Jobs } from '../src/index';
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
        const jobs = new Jobs();
        await jobs.init();
        const a = await jobs.jobCancelTest(
            (uuid: string) => {
                console.log(`Operation UUID: ${uuid}`);
            },
            50,
            50,
        );
        expect(a).toBe(100);
        const b = await jobs.jobCancelTest(
            (uuid: string) => {
                console.log(`Operation UUID: ${uuid}`);
                jobs.abort(uuid).catch((err: Error) => {
                    console.log(`Fail to abort`);
                    console.log(err);
                });
            },
            50,
            50,
        );
        expect(b).toBe(0);
        await jobs.destroy();
        finish(undefined, done);
    });
});
