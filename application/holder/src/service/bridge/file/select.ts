import { CancelablePromise } from '@platform/env/promise';
import { Instance as Logger, error } from '@platform/env/logger';
import { electron } from '@service/electron';
import { File, FileType } from '@platform/types/files';
import { getFileEntity } from '@env/fs';

import * as Requests from '@platform/ipc/request';

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

function any(ext?: string): Promise<File[]> {
    return new Promise((resolve, reject) => {
        electron
            .dialogs()
            .openFile()
            .any(ext)
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
        electron
            .dialogs()
            .openFile()
            .dlt()
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
        electron
            .dialogs()
            .openFile()
            .pcap()
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
    Requests.File.Select.Request,
    CancelablePromise<Requests.File.Select.Response>
>(
    (
        log: Logger,
        request: Requests.File.Select.Request,
    ): CancelablePromise<Requests.File.Select.Response> => {
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
                        new Requests.File.Select.Response({
                            files,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
