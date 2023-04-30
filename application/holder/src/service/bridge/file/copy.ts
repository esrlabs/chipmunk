import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as path from 'path';
import * as fs from 'fs';
import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Copy.Request,
    CancelablePromise<Requests.File.Copy.Response>
>(
    (
        log: Logger,
        request: Requests.File.Copy.Request,
    ): CancelablePromise<Requests.File.Copy.Response> => {
        return new CancelablePromise((resolve, reject) => {
            if (!fs.existsSync(request.dest)) {
                return resolve(
                    new Requests.File.Copy.Response({
                        error: `Folder ${request.dest} doesn't exist`,
                    }),
                );
            }
            if (request.files !== undefined && request.files.length !== 0) {
                const errors: string[] = [];
                Promise.allSettled(
                    request.files.map((filename) =>
                        fs.promises
                            .copyFile(filename, path.join(request.dest, path.basename(filename)))
                            .catch((err: Error) => {
                                log.warn(
                                    `Fail to copy file from ${filename} to ${request.dest}: ${err.message}`,
                                );
                                errors.push(err.message);
                            }),
                    ),
                )
                    .then((results) => {
                        if (results.filter((r) => r.status === 'rejected').length > 0) {
                            resolve(
                                new Requests.File.Copy.Response({
                                    error: `Some copy operation were failed`,
                                }),
                            );
                        } else if (errors.length > 0) {
                            resolve(new Requests.File.Copy.Response({ error: errors.join('; ') }));
                        } else {
                            resolve(new Requests.File.Copy.Response({}));
                        }
                    })
                    .catch(reject);
            } else {
                return reject(new Error(`Not supported source of data`));
            }
        });
    },
);
