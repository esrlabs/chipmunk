import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';
import * as os from 'os';

export const handler = Requests.InjectLogger<
    Requests.Os.HomeDir.Request,
    CancelablePromise<Requests.Os.HomeDir.Response>
>(
    (
        _log: Logger,
        _request: Requests.Os.HomeDir.Request,
    ): CancelablePromise<Requests.Os.HomeDir.Response> => {
        return new CancelablePromise((resolve) => {
            resolve(
                new Requests.Os.HomeDir.Response({
                    path: os.homedir(),
                }),
            );
        });
    },
);
