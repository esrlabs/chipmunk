import { paths } from '@service/paths';

import { promises as fs } from 'fs';

import * as path from 'path';

const META_FILENAME = '.metadata';

interface ReleaseMetadata {
    custom_platform?: string | null;
}

/**
 * Parses metadata file if exists and return the custom platform name when available.
 */
export async function getCustomPlatform(): Promise<string | undefined> {
    const metaFile = path.resolve(paths.getApp(), META_FILENAME);

    if (!paths.isExist(metaFile)) {
        // Only in this case we return `undefined`. In all rest cases - error if
        // we cannot read "custom_platform"
        return undefined;
    }

    const content: string = await fs
        .readFile(metaFile, 'utf-8')
        .catch((err: Error) => Promise.reject(`Fail to read ${metaFile}: ${err.message}`));

    let metadata: ReleaseMetadata | undefined;

    try {
        metadata = JSON.parse(content);
    } catch (err) {
        return Promise.reject(
            new Error(
                `Fail to parse content of ${metaFile}: ${err instanceof Error ? err.message : err}`,
            ),
        );
    }
    if (typeof metadata !== 'object' || metadata === null || metadata instanceof Array) {
        // We can be here for example if content of file is "null" or "[]"
        return Promise.reject(new Error(`File ${metaFile} has invalid metadata.`));
    }

    const platform = metadata.custom_platform;

    // It's possible that platform doesn't exist of that it's a null.
    if (typeof platform !== 'string') {
        return undefined;
    }

    const trimmedPlatform = platform.trim();

    return trimmedPlatform.length > 0 ? trimmedPlatform : undefined;
}
