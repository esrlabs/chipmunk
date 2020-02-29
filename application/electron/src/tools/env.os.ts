import * as os from 'os';

export enum EPlatforms {
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

export function getPlatform(win32Only: boolean = false): EPlatforms {
    switch (os.platform()) {
        case EPlatforms.aix:
        case EPlatforms.freebsd:
        case EPlatforms.linux:
        case EPlatforms.openbsd:
            return EPlatforms.linux;
        case EPlatforms.darwin:
            return EPlatforms.darwin;
        case EPlatforms.win32:
            if (win32Only) {
                return EPlatforms.win32;
            }
            if (os.arch() === 'x32') {
                return EPlatforms.win32;
            } else if (os.arch() === 'x64') {
                return EPlatforms.win64;
            }
            break;
    }
    return EPlatforms.undefined;
}
