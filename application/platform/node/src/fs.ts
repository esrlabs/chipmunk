import * as FS from 'fs';
import * as Path from 'path';

/**
 * Check is file/folder exist
 * @param {string} path path to file / folder
 * @returns boolean
 */
export function isExist(path: string): boolean {
    try {
        return FS.existsSync(path);
    } catch (error) {
        return false;
    }
}

export enum EReadingFolderTarget {
    all = 'all',
    files = 'files',
    folders = 'folders',
}

/**
 * Returns list of files/folders in folder
 * @param {string} path path to folder
 * @returns Promise<string[]>
 */
export function readFolder(path: string, target: EReadingFolderTarget = EReadingFolderTarget.all): Promise<string[]> {
    return new Promise((resolve, reject) => {
        FS.readdir(path, (error: NodeJS.ErrnoException, files: string[]) => {
            if (error) {
                return reject(error);
            }
            if (target === EReadingFolderTarget.all) {
                return resolve(files);
            }
            if (files.length === 0) {
                return resolve(files);
            }
            const result: string[] = [];
            Promise.all(files.map((file: string) => {
                return getEntityInfo(Path.resolve(path, file)).then((stat: FS.Stats) => {
                    if ((target === EReadingFolderTarget.files && !stat.isDirectory()) || (target === EReadingFolderTarget.folders && stat.isDirectory())) {
                        result.push(file);
                    }
                });
            })).then(() => {
                resolve(result);
            }).catch((errorReadingStat: Error) => {
                reject(errorReadingStat);
            });
        });
    });
}

/**
 * Returns list of files only in folder
 * @param {string} path path to folder
 * @returns Promise<string[]>
 */
export function readFiles(path: string): Promise<string[]> {
    return readFolder(path, EReadingFolderTarget.files);
}

/**
 * Returns list of subfolders only in folder
 * @param {string} path path to folder
 * @returns Promise<string[]>
 */
export function readFolders(path: string): Promise<string[]> {
    return readFolder(path, EReadingFolderTarget.folders);
}

/**
 * Returns information about file/folder
 * @param {string} entity path to entity. Can be file or folder
 * @returns Promise<FS.Stats>
 */
export function getEntityInfo(entity: string): Promise<FS.Stats> {
    return new Promise((resolve, reject) => {
        if (!isExist(entity)) {
            return reject(new Error(`Entity "${entity}" doesn't exist.`));
        }
        FS.stat(entity, (error: NodeJS.ErrnoException, stats: FS.Stats) => {
            if (error) {
                return reject(error);
            }
            resolve(stats);
        });
    });
}

/**
 * Returns text content of file
 * @param {string} file path to file
 * @param {string} codding codding name (default: utf8)
 * @returns Promise<FS.Stats>
 */
export function readTextFile(file: string, codding: string = 'utf8'): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!isExist(file)) {
            return reject(new Error(`File "${file}" doesn't exist.`));
        }
        FS.readFile(file, codding, (error: NodeJS.ErrnoException, data: string) => {
            if (error) {
                return reject(error);
            }
            resolve(data);
        });
    });
}

/**
 * Deletes a file
 * @param {string} file path to file
 * @returns Promise<void>
 */
export function unlink(file: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!isExist(file)) {
            return resolve();
        }
        FS.unlink(file, (error: NodeJS.ErrnoException) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
}

/**
 * Creates folder
 * @param {string} dir path to folder
 * @returns Promise<void>
 */
export function mkdir(dir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isExist(dir)) {
            return resolve();
        }
        FS.mkdir(dir, (error: NodeJS.ErrnoException) => {
            if (error) {
                return reject(error);
            }
            resolve();
        });
    });
}

/**
 * Removes folder (with content inside)
 * @param {string} dir path to folder
 * @returns Promise<void>
 */
export function rmdir(dir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!isExist(dir)) {
            return resolve();
        }
        // Get list of files and folders inside
        const files: string[] = [];
        const folders: string[] = [];
        Promise.all([
            readFiles(dir).then((nestedFiles: string[]) => {
                files.push(...nestedFiles);
            }),
            readFolders(dir).then((nestedDirs: string[]) => {
                folders.push(...nestedDirs);
            }),
        ]).then(() => {
            // Remove files
            Promise.all([
                ...files.map((nestedFile: string) => {
                    return unlink(Path.resolve(dir, nestedFile));
                }),
                ...folders.map((nestedFolder) => {
                    return rmdir(Path.resolve(dir, nestedFolder));
                }),
            ]).then(() => {
                FS.rmdir(dir, (error: NodeJS.ErrnoException) => {
                    if (error instanceof Error) {
                        return reject(error);
                    }
                    resolve();
                });
            }).catch((removingError: Error) => {
                reject(removingError);
            });
        }).catch((error: Error) => {
            reject(error);
        });
    });
}
