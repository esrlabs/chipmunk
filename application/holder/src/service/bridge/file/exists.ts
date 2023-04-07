import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as fs from 'fs';
import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.File.Exists.Request,
    CancelablePromise<Requests.File.Exists.Response>
>(
    (
        _log: Logger,
        request: Requests.File.Exists.Request,
    ): CancelablePromise<Requests.File.Exists.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            resolve(
                new Requests.File.Exists.Response({
                    exists: fs.existsSync(request.path),
                }),
            );
        });
    },
);
