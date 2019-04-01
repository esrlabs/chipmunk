import { exec, ExecOptions } from 'child_process';
import * as OS from 'os';
import * as Path from 'path';
import Logger from './env.logger';

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

export function getOSEnvVars(attachProcessEnv: boolean = false): Promise<TEnvVars> {
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
            if (attachProcessEnv) {
                Object.keys(process.env).forEach((key: string) => {
                    if (pairs[key] === undefined) {
                        pairs[key] = process.env[key] as  string;
                    }
                });
            }
            resolve(pairs);
        }).catch((error: Error) => {
            resolve(Object.assign({}, process.env) as TEnvVars);
        });
    });
}

export function whereIs(target: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        let command: string = '';
        const logger = new Logger(`whereIs: ${target}`);
        switch (OS.platform()) {
            case EPlatforms.aix:
            case EPlatforms.android:
            case EPlatforms.darwin:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
            case EPlatforms.sunos:
                command = 'which';
                break;
            case EPlatforms.win32:
                command = 'which';
                break;
        }
        shell(`${command} ${target}`).then((stdout: string) => {
            logger.env(stdout);
            if (typeof stdout !== 'string' || stdout.trim() === '') {
                return undefined;
            }
            resolve(Path.dirname(stdout));
        }).catch((error: Error) => {
            logger.warn(error.message);
            resolve(undefined);
        });
    });
}

export function getExecutedModulePath(): string {
    return Path.normalize(`${Path.dirname(require.main === void 0 ? __dirname : require.main.filename)}`);
}
