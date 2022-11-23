import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger, error } from 'platform/env/logger';
import { electron } from '@service/electron';
import { File, FileType, getFileExtention } from 'platform/types/files';
import { getFileEntity } from '@env/fs';

import * as Requests from 'platform/ipc/request';
import * as fs from 'fs';
import * as path from 'path';

export function getEntities(files: string[]): File[] | Error {
    if (files.length === 0) {
        return [];
    } else {
        try {
            return files.map((filename: string) => {
                const entity = getFileEntity(filename);
                if (entity instanceof Error) {
                    throw entity;
                }
                return entity;
            });
        } catch (e) {
            return new Error(error(e));
        }
    }
}

async function collect(exts: string[]): Promise<string[]> {
    const folders = await electron.dialogs().openFolder();
    if (folders.length === 0) {
        return Promise.resolve([]);
    }
    let files: string[] = [];
    for (const folder of folders) {
        files = files.concat(
            (await fs.promises.readdir(folder, { withFileTypes: true }))
                .filter((f) => f.isFile())
                .map((f) => path.resolve(folder, f.name)),
        );
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

function any(ext?: string): Promise<File[]> {
    return new Promise((resolve, reject) => {
        collect(ext !== undefined ? [ext] : [])
            .then((files: string[]) => {
                const entities = getEntities(files);
                if (entities instanceof Error) {
                    reject(entities);
                } else {
                    resolve(entities);
                }
            })
            .catch(reject);
    });
}

function dlt(): Promise<File[]> {
    return new Promise((resolve, reject) => {
        collect(['dlt'])
            .then((files: string[]) => {
                const entities = getEntities(files);
                if (entities instanceof Error) {
                    reject(entities);
                } else {
                    resolve(entities);
                }
            })
            .catch(reject);
    });
}

function pcap(): Promise<File[]> {
    return new Promise((resolve, reject) => {
        collect(['pcap', 'pcapng'])
            .then((files: string[]) => {
                const entities = getEntities(files);
                if (entities instanceof Error) {
                    reject(entities);
                } else {
                    resolve(entities);
                }
            })
            .catch(reject);
    });
}

export const handler = Requests.InjectLogger<
    Requests.Folder.Select.Request,
    CancelablePromise<Requests.Folder.Select.Response>
>(
    (
        log: Logger,
        request: Requests.Folder.Select.Request,
    ): CancelablePromise<Requests.Folder.Select.Response> => {
        return new CancelablePromise((resolve, reject) => {
            (() => {
                switch (request.target) {
                    case FileType.Any:
                    case FileType.Text:
                        return any(request.ext);
                    case FileType.Dlt:
                        return dlt();
                    case FileType.Pcap:
                        return pcap();
                    default:
                        return Promise.reject(new Error(`Unsupported format of file`));
                }
            })()
                .then((files: File[]) => {
                    resolve(
                        new Requests.Folder.Select.Response({
                            files,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
