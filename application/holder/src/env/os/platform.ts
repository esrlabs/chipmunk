import * as os from 'os';
import { execSync } from 'child_process';
import { scope } from 'platform/env/scope';
import { error } from 'platform/log/utils';

export enum Platform {
    aix = 'aix',
    darwin = 'darwin',
    darwinaarch64 = 'darwin-arm64',
    freebsd = 'freebsd',
    linux = 'linux',
    linuxaarch64 = 'linux-arm64',
    openbsd = 'openbsd',
    sunos = 'sunos',
    win32 = 'win32',
    win64 = 'win64',
    android = 'android',
    undefined = 'undefined',
}

let cachedCpuBrandString: string | null = null;

function safeExecSync(command: string, timeout: number): string {
    try {
        return execSync(command, { timeout }).toString().trim().toLowerCase();
    } catch (err) {
        scope.getLogger('PlatformChecker').warn(`Fail to detect arch for darwin. Command '${command}' gives error: ${error(err)}`);
        return '';
    }
}

function getCpuBrandString(): string {
    if (cachedCpuBrandString === null) {
        cachedCpuBrandString = safeExecSync('sysctl -n machdep.cpu.brand_string', 200);
    }
    return cachedCpuBrandString;
}

export function getPlatform(win32Only = false): Platform {
    switch (os.platform()) {
        case Platform.aix:
        case Platform.freebsd:
        case Platform.linux:
            if (os.arch() === 'arm64') {
                return Platform.linuxaarch64;
            } else {
                return Platform.linux;
            }
        case Platform.openbsd:
            return Platform.linux;
        case Platform.darwin: {
            const result = getCpuBrandString();
            if (os.arch() === 'arm64' || (!result.includes('intel') && result !== '')) {
                return Platform.darwinaarch64;
            } else {
                return Platform.darwin;
            }
        }
        case Platform.win32:
            if (win32Only) {
                return Platform.win32;
            }
            if (os.arch() === 'x32') {
                return Platform.win32;
            } else if (os.arch() === 'x64') {
                return Platform.win64;
            }
    }
    return Platform.undefined;
}

export function getExecutable(filename: string): string {
    return `${filename}${os.platform() === 'win32' ? '.exe' : ''}`;
}
