import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';
import * as path from 'path';

export const handler = Requests.InjectLogger<
    Requests.File.Name.Request,
    CancelablePromise<Requests.File.Name.Response>
>(
    (
        _log: Logger,
        request: Requests.File.Name.Request,
    ): CancelablePromise<Requests.File.Name.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            resolve(
                new Requests.File.Name.Response({
                    filename: request.path,
                    parent: path.dirname(request.path),
                    ext: path.extname(request.path),
                    name: path.basename(request.path),
                }),
            );
        });
    },
);
