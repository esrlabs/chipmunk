// tslint:disable-next-line: no-var-requires
const fswin = require("fswin");
import * as fs from "fs";
import * as Path from "path";
import * as os from './env.os';

/**
 * Check is file/folder exist
 * @param {string} path path to file / folder
 * @returns boolean
 */
export function isExist(path: string): boolean {
    try {
        return fs.existsSync(path);
    } catch (error) {
        return false;
    }
}

export enum EReadingFolderTarget {
    all = "all",
    files = "files",
    folders = "folders",
}

/**
 * Check is file/folder exist
 * @param {string} path path to file / folder
 * @returns boolean
 */
export function exist(path: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        fs.stat(path, (err: NodeJS.ErrnoException | null, stat: fs.Stats) => {
            if (err) {
                if (err.code === "ENOENT") {
                    return resolve(false);
                }
                return reject(err);
            }
            return resolve(true);
        });
    });
}

/**
 * Returns list of files/folders in folder
 * @param {string} path path to folder
 * @returns Promise<string[]>
 */
export function readFolder(
    path: string,
    target: EReadingFolderTarget = EReadingFolderTarget.all,
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(path, (error: NodeJS.ErrnoException | null, files: string[]) => {
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
            Promise.all(
                files.map((file: string) => {
                    return getEntityInfo(Path.resolve(path, file)).then((stat: fs.Stats) => {
                        if (
                            (target === EReadingFolderTarget.files && !stat.isDirectory()) ||
                            (target === EReadingFolderTarget.folders && stat.isDirectory())
                        ) {
                            result.push(file);
                        }
                    });
                }),
            )
                .then(() => {
                    resolve(result);
                })
                .catch((errorReadingStat: Error) => {
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
 * @returns Promise<fs.Stats>
 */
export function getEntityInfo(entity: string): Promise<fs.Stats> {
    return new Promise((resolve, reject) => {
        if (!isExist(entity)) {
            return reject(new Error(`Entity "${entity}" doesn't exist.`));
        }
        fs.stat(entity, (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
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
 * @returns Promise<fs.Stats>
 */
export function readTextFile(file: string, codding: string = "utf8"): Promise<string> {
    return new Promise((resolve, reject) => {
        exist(file).then((_exist: boolean) => {
            if (!_exist) {
                return reject(new Error(`File "${file}" doesn't exist.`));
            }
            fs.readFile(file, codding, (error: NodeJS.ErrnoException | null, data: string) => {
                if (error) {
                    return reject(error);
                }
                resolve(data);
            });
        }).catch((existErr: Error) => {
            reject(existErr);
        });
    });
}

/**
 * Write text contenent into file
 * @param {string} file path to file
 * @param {string} content content
 * @param {string} codding codding name (default: utf8)
 * @returns Promise<fs.Stats>
 */
export function writeTextFile(
    file: string,
    content: string,
    overwrite: boolean = true,
): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!overwrite && isExist(file)) {
            return reject(new Error(`File "${file}" already exists.`));
        }
        fs.writeFile(file, content, (error: NodeJS.ErrnoException | null) => {
            if (error) {
                return reject(error);
            }
            resolve();
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
        exist(file).then((_exist: boolean) => {
            if (!_exist) {
                return resolve();
            }
            fs.unlink(file, (error: NodeJS.ErrnoException | null) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        }).catch((existErr: Error) => {
            reject(existErr);
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
        fs.mkdir(dir, (error: NodeJS.ErrnoException | null) => {
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
        ])
            .then(() => {
                // Remove files
                Promise.all([
                    ...files.map((nestedFile: string) => {
                        return unlink(Path.resolve(dir, nestedFile));
                    }),
                    ...folders.map(nestedFolder => {
                        return rmdir(Path.resolve(dir, nestedFolder));
                    }),
                ])
                    .then(() => {
                        fs.rmdir(dir, (error: NodeJS.ErrnoException | null) => {
                            if (error instanceof Error) {
                                return reject(error);
                            }
                            resolve();
                        });
                    })
                    .catch((removingError: Error) => {
                        reject(removingError);
                    });
            })
            .catch((error: Error) => {
                reject(error);
            });
    });
}

export function copyFolder(source: string, dest: string) {
    const destFolder = Path.join(dest, Path.basename(source));
    if (!fs.existsSync(destFolder)) {
        fs.mkdirSync(destFolder);
    }
    if (fs.lstatSync(source).isDirectory()) {
        const files = fs.readdirSync(source);
        files.forEach((file: string) => {
            const fullname = Path.join(source, file);
            if (fs.lstatSync(fullname).isDirectory()) {
                copyFolder(fullname, destFolder);
            } else {
                fs.copyFileSync(fullname, Path.join(destFolder, file));
            }
        });
    }
}

export interface IExtendFileInfo {
    modified: number;
    created: number;
    basename: string;
    path: string;
    filename: string;
    extention: string;
    size: number;
    hidden: boolean;
}

export function getExtendFileInfo(filename: string): Promise<IExtendFileInfo> {
    return new Promise((resolve, reject) => {
        fs.lstat(filename, (lsErr, stats) => {
            if (lsErr) {
                return reject(lsErr);
            }
            if (!stats.isFile()) {
                return reject(new Error(`${filename} isn't a file`));
            }
            isHidden(filename).then((hidden: boolean) => {
                resolve({
                    modified: stats.mtimeMs,
                    created: stats.ctimeMs,
                    basename: Path.basename(filename),
                    path: Path.dirname(filename),
                    filename: filename,
                    extention: Path.extname(filename),
                    size: stats.size,
                    hidden: hidden,
                });
            }).catch(reject);
        });
    });
}

export interface IExtendFilesInfo {
    files: IExtendFileInfo[];
    errors: Error[];
}

export function getExtendFilesInfo(files: string[]): Promise<IExtendFilesInfo> {
    return new Promise((resolve, reject) => {
        const result: IExtendFilesInfo = {
            files: [],
            errors: [],
        };
        Promise.all(files.map((filename: string) => {
            return getExtendFileInfo(filename).then((info: IExtendFileInfo) => {
                result.files.push(info);
            }).catch((err: Error) => {
                result.errors.push(err);
            });
        })).then(() => {
            resolve(result);
        }).catch(reject);
    });
}

export function isHidden(path: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const ops = os.getPlatform();
        if (ops === os.EPlatforms.win32 || ops === os.EPlatforms.win64) {
            fswin.getAttributes(path, (result: any) => {
                const key = 'IS_HIDDEN';
                if (result && result[key] !== undefined) {
                    return resolve(result[key]);
                } else {
                    return reject(false);
                }
            });
        } else {
            return resolve((/(^|\/)\.[^\/\.]/g).test(path));
        }
    });
}
