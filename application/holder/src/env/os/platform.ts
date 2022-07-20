import * as os from 'os';

export enum Platform {
    aix = 'aix',
    darwin = 'darwin',
    freebsd = 'freebsd',
    linux = 'linux',
    openbsd = 'openbsd',
    sunos = 'sunos',
    win32 = 'win32',
    win64 = 'win64',
    android = 'android',
    undefined = 'undefined',
}

export function getPlatform(win32Only = false): Platform {
    switch (os.platform()) {
        case Platform.aix:
        case Platform.freebsd:
        case Platform.linux:
        case Platform.openbsd:
            return Platform.linux;
        case Platform.darwin:
            return Platform.darwin;
        case Platform.win32:
            if (win32Only) {
                return Platform.win32;
            }
            if (os.arch() === 'x32') {
                return Platform.win32;
            } else if (os.arch() === 'x64') {
                return Platform.win64;
            }
            break;
    }
    return Platform.undefined;
}

export function getExecutable(filename: string): string {
    return `${filename}${os.platform() === 'win32' ? '.exe' : ''}`;
}
