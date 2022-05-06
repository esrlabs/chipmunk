import { exec, spawn } from 'child_process';

import * as os from 'os';

import { detectAvailableProfiles as getProfiles, ITerminalProfile } from './profiles';

export { getProfiles, ITerminalProfile };

export function shell(command: string, defShell?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(
            command,
            { shell: defShell },
            (error: Error | null, stdout: string, stderr: string) => {
                if (error instanceof Error) {
                    return reject(error);
                }
                if (stderr.trim() !== '') {
                    return reject(new Error(`Finished deu error: ${stderr}`));
                }
                if (typeof stdout !== 'string' || stdout.replace(/[\n\r]/gi, '').trim() === '') {
                    stdout = '';
                }
                resolve(stdout);
            },
        );
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

export function printenv(shellFullPath?: string): Promise<TEnvVars> {
    if (os.platform() === EPlatforms.win32) {
        return Promise.reject(new Error(`This command doesn't supported by windows.`));
    }
    return new Promise((resolve, reject) => {
        (() => {
            if (shellFullPath === undefined) {
                return getDefShell();
            } else {
                return Promise.resolve(shellFullPath);
            }
        })()
            .then((defShell: string) => {
                shell('printenv', defShell)
                    .then((stdout: string) => {
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
                    })
                    .catch((error: Error) => {
                        reject(error);
                    });
            })
            .catch((defShellErr: Error) => {
                reject(defShellErr);
            });
    });
}
export function getElectronAppShellEnvVars(
    electronPath: string,
    shellFullPath?: string,
): Promise<TEnvVars> {
    return new Promise((resolve, reject) => {
        if (os.platform() !== EPlatforms.darwin) {
            return resolve(Object.assign({}, process.env) as TEnvVars);
        }
        (() => {
            if (shellFullPath === undefined) {
                return getDefShell();
            } else {
                return Promise.resolve(shellFullPath);
            }
        })()
            .then((targetShell: string) => {
                const env = {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                    ELECTRON_NO_ATTACH_CONSOLE: '1',
                };
                const marker = '__chipmunk_marker__';
                const child = spawn(
                    targetShell,
                    [
                        ...['-ilc'],
                        `'${electronPath}' -p 'JSON.stringify(Object.assign({ ${marker}: true }, process.env))'`,
                    ],
                    {
                        detached: true,
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env,
                    },
                );
                child.on('error', (err) => {
                    reject(err);
                });
                let stdout = '';
                child.stdout.on('data', (out) => (stdout += out));
                let stderr = '';
                child.stderr.on('data', (out) => (stderr += out));
                child.on('close', (code) => {
                    if (code !== 0) {
                        return reject(
                            new Error(
                                `Process has been finished with code ${code}. Stderr: ${stderr}`,
                            ),
                        );
                    }
                    try {
                        const envvars = JSON.parse(stdout);
                        if (typeof envvars !== 'object' || envvars === null || !envvars[marker]) {
                            return reject(new Error(`Invalid stdout`));
                        }
                        resolve(envvars);
                    } catch (e) {
                        reject(new Error(`Fail to parse: ${e instanceof Error ? e.message : e}`));
                    }
                });
            })
            .catch((defShellErr: Error) => {
                reject(defShellErr);
            });
    });
}

export function getEnvVar(name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const possible: string | undefined = process.env[name];
        if (typeof possible === 'string' && possible.trim() !== '') {
            return resolve(possible);
        }
        getDefShell()
            .then((defShell: string) => {
                let cmd = '';
                switch (os.platform()) {
                    case EPlatforms.aix:
                    case EPlatforms.android:
                    case EPlatforms.darwin:
                    case EPlatforms.freebsd:
                    case EPlatforms.linux:
                    case EPlatforms.openbsd:
                    case EPlatforms.sunos:
                        cmd = `echo $${name}`;
                        break;
                    case EPlatforms.win32:
                        cmd = `echo %${name}%`;
                        break;
                }
                let output = '';
                shell(cmd, defShell)
                    .then((stdout: string) => {
                        output = stdout.replace(/[\n\r]/gi, '').trim();
                        if (os.platform() === EPlatforms.win32 && output === `%${name}%`) {
                            // Try unix way
                            cmd = `echo $${name}`;
                            shell(cmd)
                                .then((stdoutUnixWay: string) => {
                                    output = stdoutUnixWay.replace(/[\n\r]/gi, '').trim();
                                    if (
                                        os.platform() === EPlatforms.win32 &&
                                        output === `$${name}`
                                    ) {
                                        output = '';
                                    }
                                    resolve(output);
                                })
                                .catch((error: Error) => {
                                    reject(error);
                                });
                        } else {
                            resolve(output);
                        }
                    })
                    .catch((error: Error) => {
                        reject(error);
                    });
            })
            .catch((defShellErr: Error) => {
                reject(defShellErr);
            });
    });
}

export function getDefShell(): Promise<string> {
    return new Promise((resolve, reject) => {
        let shellPath: string | undefined;
        let command = '';
        switch (os.platform()) {
            case EPlatforms.aix:
            case EPlatforms.android:
            case EPlatforms.darwin:
            case EPlatforms.freebsd:
            case EPlatforms.linux:
            case EPlatforms.openbsd:
            case EPlatforms.sunos:
                shellPath = process.env['SHELL'];
                command = 'echo $SHELL';
                break;
            case EPlatforms.win32:
                shellPath = process.env['COMSPEC'];
                command = 'ECHO %COMSPEC%';
                break;
        }

        if (shellPath) {
            return resolve(shellPath);
        }

        // process didn't resolve shell, so we query it manually
        shell(command)
            .then((stdout: string) => {
                resolve(stdout.trim());
            })
            .catch((error: Error) => {
                // COMSPEC should always be available on windows.
                // Therefore: we will try to use /bin/sh as error-mitigation
                reject(error);
            });
    });
}

export function getShells(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        getProfiles()
            .then((profiles: ITerminalProfile[]) => {
                const shells: string[] = [];
                profiles.forEach((p) => {
                    if (shells.indexOf(p.path) === -1) {
                        shells.push(p.path);
                    }
                });
                resolve(shells);
            })
            .catch(reject);
    });
}
