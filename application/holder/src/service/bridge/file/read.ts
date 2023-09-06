import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as fs from 'fs';
import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Read.Request,
    CancelablePromise<Requests.File.Read.Response>
>(
    (
        _log: Logger,
        request: Requests.File.Read.Request,
    ): CancelablePromise<Requests.File.Read.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            if (!fs.existsSync(request.file)) {
                return resolve(
                    new Requests.File.Read.Response({
                        text: undefined,
                        error: `File ${request.file} doesn't exist`,
                    }),
                );
            }
            fs.promises
                .readFile(request.file, { encoding: 'utf-8' })
                .then((text: string) => {
                    return resolve(
                        new Requests.File.Read.Response({
                            text,
                            error: undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    return resolve(
                        new Requests.File.Read.Response({
                            text: undefined,
                            error: `Fail to read file ${request.file}: ${err.message}`,
                        }),
                    );
                });
        });
    },
);
