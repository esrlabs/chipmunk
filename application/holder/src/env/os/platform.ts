import * as os from 'os';

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
            break;
        case Platform.openbsd:
            return Platform.linux;
        case Platform.darwin:
            if (os.arch() === 'arm64') {
                return Platform.darwinaarch64;
            } else {
                return Platform.darwin;
            }
            break;
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
