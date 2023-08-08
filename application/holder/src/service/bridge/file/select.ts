import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { electron } from '@service/electron';
import { File } from 'platform/types/files';
import { FileType } from 'platform/types/observe/types/file';
import { getFileEntities } from '@env/fs';

import * as Requests from 'platform/ipc/request';

function any(ext?: string): Promise<File[]> {
    return new Promise((resolve, reject) => {
        electron
            .dialogs()
            .openFile()
            .any(ext)
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
        electron
            .dialogs()
            .openFile()
            .dlt()
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

function pcapng(): Promise<File[]> {
    return new Promise((resolve, reject) => {
        electron
            .dialogs()
            .openFile()
            .pcapng()
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
        electron
            .dialogs()
            .openFile()
            .pcap()
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
                    case FileType.Text:
                        return any(request.ext);
                    case FileType.Binary:
                        return dlt();
                    case FileType.PcapNG:
                        return pcapng();
                    case FileType.PcapLegacy:
                        return pcap();
                    default:
                        return any(request.ext);
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
