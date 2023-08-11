import { File, Stat, getFileExtention } from 'platform/types/files';
import { getFileTypeByFilename } from 'platform/types/observe/types/file';
import { error } from 'platform/log/utils';

import * as obj from 'platform/env/obj';
import * as fs from 'fs';
import * as path from 'path';

export function exists(filename: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.stat(filename, (err) => {
            if (err == null) {
                resolve(true);
            } else if (err.code === 'ENOENT') {
                resolve(false);
            } else {
                reject(new Error(err.message));
            }
        });
    });
}

export function isDirectory(path: string): boolean | Error {
    try {
        return fs.statSync(path).isDirectory();
    } catch (_) {
        return new Error(`Fail to get stat info for "${path}"`);
    }
}

export async function getFilesFromFolder(folders: string[], exts: string[]): Promise<string[]> {
    if (folders.length === 0) {
        return Promise.resolve([]);
    }
    let files: string[] = [];
    for (const folder of folders) {
        const stat = await fs.promises.stat(folder);
        if (stat.isFile()) {
            files.push(folder);
        } else {
            files = files.concat(
                (await fs.promises.readdir(folder, { withFileTypes: true }))
                    .filter((f) => f.isFile())
                    .map((f) => path.resolve(folder, f.name)),
            );
        }
    }
    return files.filter((file) => {
        const ext = getFileExtention(file).toLowerCase();
        if (exts.length === 0) {
            return true;
        } else {
            return exts.indexOf(ext) !== -1;
        }
    });
}

export function getFolders(paths: string[]): string[] | Error {
    if (paths.length === 0) {
        return [];
    } else {
        let error: Error | undefined = undefined;
        const folders = paths.filter((path) => {
            if (error !== undefined) {
                return false;
            }
            const check = isDirectory(path);
            if (check instanceof Error) {
                error = check;
            }
            return check;
        });
        return error !== undefined ? error : folders;
    }
}

export function getFileEntities(files: string[]): File[] | Error {
    if (files.length === 0) {
        return [];
    } else {
        try {
            return files
                .map((filename: string) => {
                    const entity: File | Error | undefined = getFileEntity(filename);
                    if (entity instanceof Error) {
                        throw entity;
                    }
                    return entity;
                })
                .filter((f) => f !== undefined) as File[];
        } catch (e) {
            return new Error(error(e));
        }
    }
}

export function getFileEntity(filename: string): File | undefined | Error {
    try {
        const stat = fs.statSync(filename);
        if (!stat.isFile()) {
            return undefined;
        }
        return {
            filename,
            ext: path.extname(filename),
            path: path.dirname(filename),
            name: path.basename(filename),
            stat: obj.from<Stat>(stat, [
                'dev',
                'ino',
                'mode',
                'nlink',
                'uid',
                'gid',
                'rdev',
                'size',
                'blksize',
                'blocks',
                'atimeMs',
                'mtimeMs',
                'ctimeMs',
                'birthtimeMs',
            ]),
            type: getFileTypeByFilename(filename),
        };
    } catch (_) {
        return new Error(`Fail to get stat info for "${filename}"`);
    }
}
