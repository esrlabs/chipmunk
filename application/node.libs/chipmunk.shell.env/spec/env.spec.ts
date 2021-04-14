/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

// Use to start test ./node_modules/.bin/jasmine-ts src/something.spec.ts

import * as EnvLib from '../src/index';


describe('OS env tools', () => {
    beforeEach(() => {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
    });

    it('Getting profiles', (done: () => any ) => {
        EnvLib.getProfiles().then((profiles: EnvLib.ITerminalProfile[]) => {
            expect(profiles.length >= 1).toBe(true);
            if (process.platform === 'win32') {
                expect(profiles.find((p) => p.profileName.toLowerCase() === 'Command Prompt'.toLowerCase())).toBeDefined();
            }
            console.info(`Found profiles:\n\t- ${profiles.map((p) => p.profileName).join(`\n\t- `)}`);
            done();
        }).catch((err: Error) => {
            fail(err);
        });
    });

    it('Getting shells', (done: () => any ) => {
        EnvLib.getShells().then((shells: string[]) => {
            expect(shells.length >= 1).toBe(true);
            if (process.platform === 'win32') {
                //expect(profiles.find((p) => p.profileName.toLowerCase() === 'Command Prompt'.toLowerCase())).toBeDefined();
            }
            console.info(`Found shells:\n\t- ${shells.join(`\n\t- `)}`);
            done();
        }).catch((err: Error) => {
            fail(err);
        });
    });

    it('Getting envvars', (done: () => any ) => {
        EnvLib.getEnvVars().then((envvars: EnvLib.TEnvVars) => {
            expect(Object.keys(envvars).length > 0).toBe(true);
            console.info(`Found envvars:\n\t- ${Object.keys(envvars).map((k) => `${k}: ${envvars[k]}`).join(`\n\t- `)}`)
            done();
        }).catch((err: Error) => {
            fail(err);
        });
    });

    it('Getting default shell', (done: () => any ) => {
        EnvLib.getDefShell().then((shell: string) => {
            expect(typeof shell === 'string').toBe(true);
            expect(shell.trim().length > 0).toBe(true);
            console.info(`Default shell: ${shell}`);
            done();
        }).catch((err: Error) => {
            fail(err);
        });
    });

});
