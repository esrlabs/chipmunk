// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { shells } from '../src/index';
import { finish } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.shells;

function ignore(id: string | number, done: () => void) {
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

describe('Shells', function () {
    it(config.regular.list[1], function (done) {
        const testName = config.regular.list[1];
        if (ignore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        (async () => {
            try {
                const profiles = await shells.getValidProfiles();
                expect(profiles.length > 0).toBe(true);
                finish(undefined, done, undefined);
                return Promise.resolve();
            } catch (err) {
                return Promise.reject(err instanceof Error ? err : new Error(`${err}`));
            }
        })().catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Fail to finish test due error: ${err instanceof Error ? err.message : err}`,
                ),
            );
        });
    });
    it(config.regular.list[2], function (done) {
        const testName = config.regular.list[2];
        if (ignore(1, done)) {
            return;
        }
        console.log(`\nStarting: ${testName}`);
        (async () => {
            try {
                const envvars = await shells.getContextEnvvars();
                expect(envvars.size > 0).toBe(true);
                expect(envvars.has('PATH') || envvars.has('path') || envvars.has('Path')).toBe(
                    true,
                );
                finish(undefined, done, undefined);
                return Promise.resolve();
            } catch (err) {
                return Promise.reject(err instanceof Error ? err : new Error(`${err}`));
            }
        })().catch((err: Error) => {
            finish(
                undefined,
                done,
                new Error(
                    `Fail to finish test due error: ${err instanceof Error ? err.message : err}`,
                ),
            );
        });
    });
});
