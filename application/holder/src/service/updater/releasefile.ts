import { Platform, getPlatform } from '@env/os/platform';
import { paths } from '@service/paths';

import * as os from 'os';
import * as path from 'path';

const NAME = 'chipmunk';
const HOOKS = {
    name: '<name>',
    version: '<version>',
    prefix: '<prefix>',
    platform: '<platform>',
};

const PATERN = `${HOOKS.name}${HOOKS.prefix}@${HOOKS.version}-${HOOKS.platform}-portable.tgz`;

export class ReleaseFile {
    public readonly filename: string;
    constructor(version: string, prefix = '', platform?: string) {
        if (platform === undefined) {
            const plat = getPlatform();
            if (plat === Platform.undefined) {
                throw new Error(`Fail to detect supported platform for (${os.platform()}).`);
            }
            platform = plat.toString();
        }

        this.filename = PATERN.replace(HOOKS.name, NAME)
            .replace(HOOKS.prefix, `${prefix === '' ? '' : `-${prefix}`}`)
            .replace(HOOKS.version, version)
            .replace(HOOKS.platform, platform);
    }

    public equal(filename: string): boolean {
        return filename === this.filename;
    }
}
