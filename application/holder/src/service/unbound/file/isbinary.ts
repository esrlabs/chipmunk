import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.IsBinary.Request,
    CancelablePromise<Requests.File.IsBinary.Response>
>(
    (
        log: Logger,
        request: Requests.File.IsBinary.Request,
    ): CancelablePromise<Requests.File.IsBinary.Response> => {
        return new CancelablePromise((resolve) => {
            unbound.jobs
                .isFileBinary({ filePath: request.file })
                .then((binary) => {
                    resolve(
                        new Requests.File.IsBinary.Response({
                            binary,
                            error: undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.File.IsBinary.Response({
                            binary: false,
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
