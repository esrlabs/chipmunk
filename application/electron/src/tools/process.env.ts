import { exec, ExecOptions, SpawnOptions, spawn } from 'child_process';
import * as OS from 'os';
import * as Path from 'path';
import * as uuid from 'uuid';
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

export function detached(command: string, args: string[], options: SpawnOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        options = typeof options === 'object' ? (options !== null ? options : {}) : {};
        options.detached = true;
        const output: Buffer[] = [];
        const child = spawn(command, args, options);
        child.on('error', (error: Error) => {
            reject(error);
        });
        child.stdout.on('data', (chunk: Buffer) => {
            output.push(chunk);
        });
        child.on('close', (code: number, signal: any) => {
            if (code !== 0) {
                return reject(new Error(`Failed to spawn, because code is "${code}"`));
            }
            resolve(Buffer.concat(output).toString('utf8'));
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

export type TEnvVars = { [key: string]: any };

let _cachedShellEnvironment: TEnvVars = {};

export function getShellEnvironment(): Promise<TEnvVars> {
    return new Promise((resolve) => {
        if (Object.keys(_cachedShellEnvironment).length > 0) {
            return resolve(Object.assign({}, _cachedShellEnvironment));
        }
        let ref: () => Promise<TEnvVars> = getUnixShellEnvironment;
        const logger = new Logger(`getOSEnvVars`);
        switch (OS.platform()) {
            case EPlatforms.aix:
            case EPlatforms.android:
            case EPlatforms.darwin:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
            case EPlatforms.sunos:
                ref = getUnixShellEnvironment;
                break;
            case EPlatforms.win32:
                ref = getWindowsShellEnvironment;
                break;
        }
        ref().then((env: TEnvVars) => {
            _cachedShellEnvironment = Object.assign({}, env);
            resolve(env);
        }).catch((error: Error) => {
            logger.warn(`Fail to detect OS env due error: ${error.message}`);
            resolve(Object.assign({}, process.env));
        });
    });
}

export function getUnixShellEnvironment(): Promise<TEnvVars> {
    // This method is done based on code of VSCode (src/vs/code/node/shellEnv.ts)
    return new Promise((resolve, reject) => {
        const runAsNode: string | undefined = process.env.ELECTRON_RUN_AS_NODE;
        const noAttach: string | undefined = process.env.ELECTRON_NO_ATTACH_CONSOLE;
        const mark: string = uuid.v4().replace(/-/g, '').substr(0, 12);
        const regex: RegExp = new RegExp(mark + '(.*)' + mark);
        const env: TEnvVars = Object.assign(process.env, {
            ELECTRON_RUN_AS_NODE: '1',
            ELECTRON_NO_ATTACH_CONSOLE: '1',
        });
        const command: string = `'${process.execPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
        detached(process.env.SHELL!, ['-ilc', command], {
            stdio: ['ignore', 'pipe', process.stderr],
            env: env,
        }).then((output: string) => {
            const match = regex.exec(output);
            const rawStripped = match ? match[1] : '{}';
            try {
                const result = JSON.parse(rawStripped);
                if (runAsNode) {
                    result.ELECTRON_RUN_AS_NODE = runAsNode;
                } else {
                    delete result.ELECTRON_RUN_AS_NODE;
                }
                if (noAttach) {
                    result.ELECTRON_NO_ATTACH_CONSOLE = noAttach;
                } else {
                    delete result.ELECTRON_NO_ATTACH_CONSOLE;
                }
                delete result.XDG_RUNTIME_DIR;
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    });
}

export function getWindowsShellEnvironment(): Promise<TEnvVars> {
    return new Promise((resolve) => {
        resolve(Object.assign({}, process.env));
    });
}

export function getExecutedModulePath(): string {
    return Path.normalize(`${Path.dirname(require.main === void 0 ? __dirname : require.main.filename)}`);
}
