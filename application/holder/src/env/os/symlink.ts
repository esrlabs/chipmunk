/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';

export namespace SymlinkSupport {
    export interface IStats {
        // The stats of the file. If the file is a symbolic
        // link, the stats will be of that target file and
        // not the link itself.
        // If the file is a symbolic link pointing to a non
        // existing file, the stat will be of the link and
        // the `dangling` flag will indicate this.
        stat: fs.Stats;

        // Will be provided if the resource is a symbolic link
        // on disk. Use the `dangling` flag to find out if it
        // points to a resource that does not exist on disk.
        symbolicLink?: { dangling: boolean };
    }

    /**
     * Resolves the `fs.Stats` of the provided path. If the path is a
     * symbolic link, the `fs.Stats` will be from the target it points
     * to. If the target does not exist, `dangling: true` will be returned
     * as `symbolicLink` value.
     */
    export async function stat(path: string): Promise<IStats> {
        // First stat the link
        let lstats: fs.Stats | undefined;
        try {
            lstats = await fs.promises.lstat(path);

            // Return early if the stat is not a symbolic link at all
            if (!lstats.isSymbolicLink()) {
                return { stat: lstats };
            }
        } catch (error) {
            /* ignore - use stat() instead */
        }

        // If the stat is a symbolic link or failed to stat, use fs.stat()
        // which for symbolic links will stat the target they point to
        try {
            const stats = await fs.promises.stat(path);

            return {
                stat: stats,
                symbolicLink: lstats?.isSymbolicLink() ? { dangling: false } : undefined,
            };
        } catch (error) {
            // If the link points to a non-existing file we still want
            // to return it as result while setting dangling: true flag
            if ((error as any).code === 'ENOENT' && lstats) {
                return { stat: lstats, symbolicLink: { dangling: true } };
            }

            // Windows: workaround a node.js bug where reparse points
            // are not supported (https://github.com/nodejs/node/issues/36790)
            if (process.platform === 'win32' && (error as any).code === 'EACCES') {
                try {
                    const stats = await fs.promises.stat(await fs.promises.readlink(path));

                    return { stat: stats, symbolicLink: { dangling: false } };
                } catch (error) {
                    // If the link points to a non-existing file we still want
                    // to return it as result while setting dangling: true flag
                    if ((error as any).code === 'ENOENT' && lstats) {
                        return { stat: lstats, symbolicLink: { dangling: true } };
                    }

                    throw error;
                }
            }

            throw error;
        }
    }

    /**
     * Figures out if the `path` exists and is a file with support
     * for symlinks.
     *
     * Note: this will return `false` for a symlink that exists on
     * disk but is dangling (pointing to a non-existing path).
     *
     * Use `exists` if you only care about the path existing on disk
     * or not without support for symbolic links.
     */
    export async function existsFile(path: string): Promise<boolean> {
        try {
            const { stat, symbolicLink } = await SymlinkSupport.stat(path);

            return stat.isFile() && symbolicLink?.dangling !== true;
        } catch (error) {
            // Ignore, path might not exist
        }

        return false;
    }

    /**
     * Figures out if the `path` exists and is a directory with support for
     * symlinks.
     *
     * Note: this will return `false` for a symlink that exists on
     * disk but is dangling (pointing to a non-existing path).
     *
     * Use `exists` if you only care about the path existing on disk
     * or not without support for symbolic links.
     */
    export async function existsDirectory(path: string): Promise<boolean> {
        try {
            const { stat, symbolicLink } = await SymlinkSupport.stat(path);

            return stat.isDirectory() && symbolicLink?.dangling !== true;
        } catch (error) {
            // Ignore, path might not exist
        }

        return false;
    }
}
