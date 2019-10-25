import { exec, ExecOptions } from 'child_process';
import * as OS from 'os';
import * as Path from 'path';
import * as shellEnv from 'shell-env';

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

export function getOSEnvVars(shell: string): Promise<TEnvVars> {
    return new Promise((resolve) => {
        if (OS.platform() !== EPlatforms.darwin) {
            return resolve(Object.assign({}, process.env) as TEnvVars);
        }
        shellEnv(shell).then((env) => {
            // console.log(`Next os env variables were detected:`);
            // console.log(env);
            resolve(env);
        }).catch((error: Error) => {
            console.log('Shell-Env Error:');
            console.log(error);
            resolve(Object.assign({}, process.env) as TEnvVars);
        });
    });
}

export function defaultShell(): Promise<string> {
    return new Promise((resolve) => {
        let shellPath: string | undefined = '';
        let command: string = '';

        switch (OS.platform()) {
            case EPlatforms.aix:
            case EPlatforms.android:
            case EPlatforms.darwin:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
            case EPlatforms.sunos:
                shellPath = process.env.SHELL;
                command = 'echo $SHELL';
                break;
            case EPlatforms.win32:
                shellPath = process.env.COMSPEC;
                command = 'ECHO %COMSPEC%';
                break;
        }

        if (shellPath) {
            return resolve(shellPath);
        }

        // process didn't resolve shell, so we query it manually
        shell(command).then((stdout: string) => {
            resolve(stdout.trim());
        }).catch((error: Error) => {
            // COMSPEC should always be available on windows.
            // Therefore: we will try to use /bin/sh as error-mitigation
            resolve("/bin/sh");
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

export function getHomePath(): string {
    return Path.normalize(`${OS.homedir()}`);
}
