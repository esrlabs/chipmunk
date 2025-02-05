import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as fs from 'fs';
import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Write.Request,
    CancelablePromise<Requests.File.Read.Response>
>(
    (
        _log: Logger,
        request: Requests.File.Write.Request,
    ): CancelablePromise<Requests.File.Write.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const exist = fs.existsSync(request.filename);
            if (exist && !request.overwrite) {
                return resolve(
                    new Requests.File.Write.Response({
                        error: `File ${request.filename} exist`,
                    }),
                );
            }
            fs.promises
                .writeFile(request.filename, request.content, 'utf8')
                .then(() => {
                    return resolve(
                        new Requests.File.Write.Response({
                            error: undefined,
                        }),
                    );
                })
                .catch((err: Error) => {
                    return resolve(
                        new Requests.File.Write.Response({
                            error: `Fail to write file ${request.filename}: ${err.message}`,
                        }),
                    );
                });
        });
    },
);
