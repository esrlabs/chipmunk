import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { getFileEntities, getFolders, getFilesFromFolder } from '@env/fs';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.File.Request,
    CancelablePromise<Requests.File.File.Response>
>(
    (
        log: Logger,
        request: Requests.File.File.Request,
    ): CancelablePromise<Requests.File.File.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const folders = getFolders(request.filename);
            if (folders instanceof Error) {
                return reject(folders);
            }
            getFilesFromFolder(folders, [])
                .then((paths: string[]) => {
                    const files = getFileEntities(request.filename.concat(paths));
                    if (files instanceof Error) {
                        return reject(files);
                    }
                    resolve(
                        new Requests.File.File.Response({
                            files,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
