import { paths } from '@service/paths';

import { promises as fs } from 'fs';

import * as path from 'path';

const META_FILENAME = '.metadata';

/**
 * Parses metadata file if exists and return the custom platform name when available.
 */
export async function getCustomPlatform(): Promise<string | undefined> {
    const metaFile = path.resolve(paths.getApp(), META_FILENAME);
    if (!paths.isExist(metaFile)) {
        return undefined;
    }

    const fileContent = await fs.readFile(metaFile, 'utf-8');

    const metadata = JSON.parse(fileContent);

    // We expect the JSON content to have the field `custom_platform`
    const platform = metadata.custom_platform;

    if (typeof platform === 'string' && platform.length > 0) {
        return platform;
    }

    return undefined;
}
