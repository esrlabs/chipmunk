/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-prototype-builtins */
/* eslint-disable @typescript-eslint/no-explicit-any */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// NOTE: Chipmunk's partial copying of VSCode solution. Related modules/libs:
// https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/node/terminalProfiles.ts
// https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/node/terminalEnvironment.ts
// https://github.com/microsoft/vscode/blob/main/src/vs/base/node/pfs.ts

import * as fs from 'fs';
import * as os from 'os';
import * as cp from 'child_process';
import * as paths from 'path';
import * as ps from './powershell';

const ENOENT = 'ENOENT';

export interface ITerminalProfile {
    profileName: string;
    path: string;
    args?: string | string[] | undefined;
    env?: ITerminalEnvironment;
}

export interface ITerminalEnvironment {
    [key: string]: string | null | undefined;
}

export const enum ProfileSource {
    GitBash = 'Git Bash',
    Pwsh = 'PowerShell',
}

export interface ITerminalExecutable {
    path: string | string[];
    args?: string | string[] | undefined;
    env?: ITerminalEnvironment;
}

export interface ITerminalProfileSource {
    source: ProfileSource;
    args?: string | string[] | undefined;
    env?: ITerminalEnvironment;
}

export type ITerminalProfileObject = ITerminalExecutable | ITerminalProfileSource | null;

export function exists(filename: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.access(filename, fs.constants.F_OK, (err: NodeJS.ErrnoException | null) => {
            if (err) {
                if (err.code === ENOENT) {
                    return resolve(false);
                } else {
                    return reject(err);
                }
            } else {
                resolve(true);
            }
        });
    });
}

let profileSources: Map<string, IPotentialTerminalProfile> | undefined;

export function getWindowsBuildNumber(): number {
    const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(os.release());
    let buildNumber = 0;
    if (osVersion && osVersion.length === 4) {
        buildNumber = parseInt(osVersion[3]);
    }
    return buildNumber;
}

export function getCaseInsensitive(target: any, key: string): any {
    const lowercaseKey = key.toLowerCase();
    const equivalentKey = Object.keys(target).find((k) => k.toLowerCase() === lowercaseKey);
    return equivalentKey ? target[equivalentKey] : target[key];
}

export async function findExecutable(
    command: string,
    cwd?: string,
    pathsToCheck?: string[],
    env: ITerminalEnvironment = process.env as ITerminalEnvironment,
): Promise<string | undefined> {
    // If we have an absolute path then we take it.
    if (paths.isAbsolute(command)) {
        return (await exists(command)) ? command : undefined;
    }
    if (cwd === undefined) {
        cwd = process.cwd();
    }
    const dir = paths.dirname(command);
    if (dir !== '.') {
        // We have a directory and the directory is relative (see above). Make the path absolute
        // to the current working directory.
        const fullPath = paths.join(cwd, command);
        return (await exists(fullPath)) ? fullPath : undefined;
    }
    const envPath = getCaseInsensitive(env, 'PATH');
    if (pathsToCheck === undefined && typeof envPath === 'string') {
        pathsToCheck = envPath.split(paths.delimiter);
    }
    // No PATH environment. Make path absolute to the cwd.
    if (pathsToCheck === undefined || pathsToCheck.length === 0) {
        const fullPath = paths.join(cwd, command);
        return (await exists(fullPath)) ? fullPath : undefined;
    }
    // We have a simple file name. We get the path variable from the env
    // and try to find the executable on the path.
    for (const pathEntry of pathsToCheck) {
        // The path entry is absolute.
        let fullPath: string;
        if (paths.isAbsolute(pathEntry)) {
            fullPath = paths.join(pathEntry, command);
        } else {
            fullPath = paths.join(cwd, pathEntry, command);
        }

        if (await exists(fullPath)) {
            return fullPath;
        }
        if (process.platform === 'win32') {
            let withExtension = fullPath + '.com';
            if (await exists(withExtension)) {
                return withExtension;
            }
            withExtension = fullPath + '.exe';
            if (await exists(withExtension)) {
                return withExtension;
            }
        }
    }
    const fullPath = paths.join(cwd, command);
    return (await exists(fullPath)) ? fullPath : undefined;
}

export function detectAvailableProfiles(): Promise<ITerminalProfile[]> {
    if (process.platform === 'win32') {
        return detectAvailableWindowsProfiles();
    }
    return detectAvailableUnixProfiles();
}

async function detectAvailableWindowsProfiles(): Promise<ITerminalProfile[]> {
    // Determine the correct System32 path. We want to point to Sysnative
    // when the 32-bit version of VS Code is running on a 64-bit machine.
    // The reason for this is because PowerShell's important PSReadline
    // module doesn't work if this is not the case. See #27915.
    const is32ProcessOn64Windows = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    const system32Path = `${process.env['windir']}\\${
        is32ProcessOn64Windows ? 'Sysnative' : 'System32'
    }`;

    let useWSLexe = false;

    if (getWindowsBuildNumber() >= 16299) {
        useWSLexe = true;
    }

    await initializeWindowsProfiles();

    const detectedProfiles: Map<string, ITerminalProfileObject> = new Map();

    // Add auto detected profiles
    detectedProfiles.set('PowerShell', {
        source: ProfileSource.Pwsh,
    });
    detectedProfiles.set('Windows PowerShell', {
        path: `${system32Path}\\WindowsPowerShell\\v1.0\\powershell.exe`,
    });
    detectedProfiles.set('Git Bash', { source: ProfileSource.GitBash });
    detectedProfiles.set('Cygwin', {
        path: [
            `${process.env['HOMEDRIVE']}\\cygwin64\\bin\\bash.exe`,
            `${process.env['HOMEDRIVE']}\\cygwin\\bin\\bash.exe`,
        ],
        args: ['--login'],
    });
    detectedProfiles.set('Command Prompt', {
        path: `${system32Path}\\cmd.exe`,
    });

    const resultProfiles: ITerminalProfile[] = await transformToTerminalProfiles(
        detectedProfiles.entries(),
    );

    try {
        const result = await getWslProfiles(
            `${system32Path}\\${useWSLexe ? 'wsl.exe' : 'bash.exe'}`,
            useWSLexe,
        );
        if (result) {
            resultProfiles.push(...result);
        }
    } catch (e) {
        console.info('WSL is not installed, so could not detect WSL profiles');
    }

    return resultProfiles;
}

async function transformToTerminalProfiles(
    entries: IterableIterator<[string, ITerminalProfileObject]>,
): Promise<ITerminalProfile[]> {
    const resultProfiles: ITerminalProfile[] = [];
    for (const [profileName, profile] of entries) {
        if (profile === null) {
            continue;
        }
        let originalPaths: string[];
        let args: string[] | string | undefined;
        if ('source' in profile) {
            const source = profileSources?.get(profile.source);
            if (!source) {
                continue;
            }
            originalPaths = source.paths;

            // if there are configured args, override the default ones
            args = profile.args || source.args;
        } else {
            originalPaths = Array.isArray(profile.path) ? profile.path : [profile.path];
            args =
                process.platform === 'win32'
                    ? profile.args
                    : Array.isArray(profile.args)
                    ? profile.args
                    : undefined;
        }

        const paths = originalPaths.slice();

        const validatedProfile = await validateProfilePaths(profileName, paths, args, profile.env);
        if (validatedProfile) {
            resultProfiles.push(validatedProfile);
        }
    }
    return resultProfiles;
}

async function initializeWindowsProfiles(): Promise<void> {
    if (profileSources) {
        return;
    }

    profileSources = new Map();
    profileSources.set('Git Bash', {
        profileName: 'Git Bash',
        paths: [
            `${process.env['ProgramW6432']}\\Git\\bin\\bash.exe`,
            `${process.env['ProgramW6432']}\\Git\\usr\\bin\\bash.exe`,
            `${process.env['ProgramFiles']}\\Git\\bin\\bash.exe`,
            `${process.env['ProgramFiles']}\\Git\\usr\\bin\\bash.exe`,
            `${process.env['LocalAppData']}\\Programs\\Git\\bin\\bash.exe`,
        ],
        args: ['--login'],
    });
    profileSources.set('PowerShell', {
        profileName: 'PowerShell',
        paths: await getPowershellPaths(),
    });
}

async function getPowershellPaths(): Promise<string[]> {
    const paths: string[] = [];
    // Add all of the different kinds of PowerShells
    for await (const pwshExe of ps.enumeratePowerShellInstallations()) {
        paths.push(pwshExe.exePath);
    }
    return paths;
}

async function getWslProfiles(
    wslPath: string,
    useWslProfiles?: boolean,
): Promise<ITerminalProfile[]> {
    const profiles: ITerminalProfile[] = [];
    if (useWslProfiles) {
        const distroOutput = await new Promise<string>((resolve, reject) => {
            // wsl.exe output is encoded in utf16le (ie. A -> 0x4100)
            cp.exec('wsl.exe -l -q', { encoding: 'utf16le' }, (err, stdout) => {
                if (err) {
                    return reject(new Error('Problem occurred when getting wsl distros'));
                }
                resolve(stdout);
            });
        });
        if (distroOutput) {
            const regex = new RegExp(/[\r?\n]/);
            const distroNames = distroOutput
                .split(regex)
                .filter((t) => t.trim().length > 0 && t !== '');
            for (const distroName of distroNames) {
                // Skip empty lines
                if (distroName === '') {
                    continue;
                }

                // docker-desktop and docker-desktop-data are treated as implementation details of
                // Docker Desktop for Windows and therefore not exposed
                if (distroName.startsWith('docker-desktop')) {
                    continue;
                }
                const profile: ITerminalProfile = {
                    profileName: `${distroName} (WSL)`,
                    path: wslPath,
                    args: [`-d`, `${distroName}`],
                };
                // Add the profile
                profiles.push(profile);
            }
            return profiles;
        }
    }
    return [];
}

async function detectAvailableUnixProfiles(): Promise<ITerminalProfile[]> {
    const detectedProfiles: Map<string, ITerminalProfileObject> = new Map();

    const contents = await fs.promises.readFile('/etc/shells', 'utf8');
    const profiles = contents
        .split('\n')
        .filter((e) => e.trim().indexOf('#') !== 0 && e.trim().length > 0);
    const counts: Map<string, number> = new Map();
    for (const profile of profiles) {
        let profileName = paths.basename(profile);
        let count = counts.get(profileName) || 0;
        count++;
        if (count > 1) {
            profileName = `${profileName} (${count})`;
        }
        counts.set(profileName, count);
        detectedProfiles.set(profileName, { path: profile });
    }
    return await transformToTerminalProfiles(detectedProfiles.entries());
}

async function validateProfilePaths(
    profileName: string,
    potentialPaths: string[],
    args?: string[] | string,
    env?: ITerminalEnvironment,
): Promise<ITerminalProfile | undefined> {
    if (potentialPaths.length === 0) {
        return Promise.resolve(undefined);
    }
    const path = potentialPaths.shift()!;
    if (path === '') {
        return validateProfilePaths(profileName, potentialPaths, args, env);
    }

    const profile: ITerminalProfile = { profileName, path, args, env };

    // For non-absolute paths, check if it's available on $PATH
    if (paths.basename(path) === path) {
        // The executable isn't an absolute path, try find it on the PATH
        const envPaths: string[] | undefined = process.env['PATH']
            ? process.env['PATH'].split(paths.delimiter)
            : undefined;
        const executable = await findExecutable(path, undefined, envPaths, undefined);
        if (!executable) {
            return validateProfilePaths(profileName, potentialPaths, args);
        }
        return profile;
    }

    const result = await exists(paths.normalize(path));
    if (result) {
        return profile;
    }

    return validateProfilePaths(profileName, potentialPaths, args, env);
}

export interface IFsProvider {
    existsFile(path: string): Promise<boolean>;
    readFile(
        path: string,
        options: { encoding: BufferEncoding; flag?: string | number } | BufferEncoding,
    ): Promise<string>;
}

interface IPotentialTerminalProfile {
    profileName: string;
    paths: string[];
    args?: string[];
}
