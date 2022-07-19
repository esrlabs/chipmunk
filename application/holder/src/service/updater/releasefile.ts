import { Platform, getPlatform } from '@env/os/platform';

import * as os from 'os';

const NAME = 'chipmunk';
const HOOKS = {
    name: '<name>',
    version: '<version>',
    platform: '<platform>',
};

const PATERN = `${HOOKS.name}-next@${HOOKS.version}-${HOOKS.platform}-portable.${
    os.platform() === 'win32' ? 'zip' : 'tgz'
}`;

export class ReleaseFile {
    public readonly filename: string;

    constructor(version: string) {
        const platform: Platform = getPlatform();
        if (platform === Platform.undefined) {
            throw new Error(`Fail to detect supported platform for (${os.platform()}).`);
        }
        this.filename = PATERN.replace(HOOKS.name, NAME)
            .replace(HOOKS.version, version)
            .replace(HOOKS.platform, platform);
    }

    public equal(filename: string): boolean {
        return filename === this.filename;
    }
}
