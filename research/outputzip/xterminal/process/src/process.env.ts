import { exec, ExecOptions } from 'child_process';
import * as OS from 'os';
import * as Path from 'path';

export function shell(command: string, options: ExecOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        options = typeof options === 'object' ? (options !== null ? options : {}) : {};
        exec(command, options, (error: Error | null, stdout: string, stderr: string) => {
            if (error instanceof Error) {
                return reject(error);
            }
            if (stderr.trim() !== '') {
                return reject(new Error(`Finished deu error: ${stderr}`));
            }
            resolve(stdout);
        });
    });
}

export enum EPlatforms {
    aix = 'aix',
    darwin = 'darwin',
    freebsd = 'freebsd',
    linux = 'linux',
    openbsd = 'openbsd',
    sunos = 'sunos',
    win32 = 'win32',
    android = 'android',
}

export type TEnvVars = { [key: string]: string };

export function getOSEnvVars(): Promise<TEnvVars> {
    return new Promise((resolve) => {
        let command: string = '';
        switch (OS.platform()) {
            case EPlatforms.aix:
            case EPlatforms.android:
            case EPlatforms.darwin:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
            case EPlatforms.sunos:
                command = 'printenv';
                break;
            case EPlatforms.win32:
                // TODO: Find solution for win
                command = 'printenv';
                break;
        }
        shell(command).then((stdout: string) => {
            const pairs: TEnvVars = {};
            stdout.split(/[\n\r]/gi).forEach((row: string) => {
                const pair: string[] = row.split('=');
                if (pair.length <= 1) {
                    return;
                }
                pairs[pair[0]] = row.replace(`${pair[0]}=`, '');
            });
            if (Object.keys(pairs).length === 0) {
                return resolve(Object.assign({}, process.env) as TEnvVars);
            }
            resolve(pairs);
        }).catch((error: Error) => {
            resolve(Object.assign({}, process.env) as TEnvVars);
        });
    });
}

export function shells(): Promise<string[]> {
    return new Promise((resolve) => {
        let command: string = '';
        switch (OS.platform()) {
            case EPlatforms.aix:
            case EPlatforms.android:
            case EPlatforms.darwin:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
            case EPlatforms.sunos:
                command = 'cat /etc/shells';
                break;
            case EPlatforms.win32:
                // TODO: Check solution with win
                command = 'cmd.com';
                break;
        }
        shell(command).then((stdout: string) => {
            const values: string[] = stdout.split(/[\n\r]/gi).filter((value: string) => {
                return value.indexOf('/') === 0;
            });
            resolve(values);
        }).catch((error: Error) => {
            resolve([]);
        });
    });
}

export function getExecutedModulePath(): string {
    return Path.normalize(`${Path.dirname(require.main === void 0 ? __dirname : require.main.filename)}`);
}
