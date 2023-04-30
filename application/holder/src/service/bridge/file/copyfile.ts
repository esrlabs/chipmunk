import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as fs from 'fs';
import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.CopyFile.Request,
    CancelablePromise<Requests.File.CopyFile.Response>
>(
    (
        log: Logger,
        request: Requests.File.CopyFile.Request,
    ): CancelablePromise<Requests.File.CopyFile.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            fs.promises
                .copyFile(request.src, request.dest)
                .then(() => {
                    resolve(new Requests.File.Copy.Response({}));
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.File.Copy.Response({
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
