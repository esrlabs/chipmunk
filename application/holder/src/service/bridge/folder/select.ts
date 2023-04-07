import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { electron } from '@service/electron';
import { File, FileType } from 'platform/types/files';
import { getFileEntities, getFilesFromFolder } from '@env/fs';

import * as Requests from 'platform/ipc/request';

async function collect(exts: string[]): Promise<string[]> {
    const folders = await electron.dialogs().openFolder();
    if (folders.length === 0) {
        return Promise.resolve([]);
    }
    return getFilesFromFolder(folders, exts);
}

function any(ext?: string): Promise<File[]> {
    return new Promise((resolve, reject) => {
        collect(ext !== undefined ? [ext] : [])
            .then((files: string[]) => {
                const entities = getFileEntities(files);
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
                const entities = getFileEntities(files);
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
                const entities = getFileEntities(files);
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
