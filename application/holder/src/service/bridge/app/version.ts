import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { version } from '@module/version';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.App.Version.Request,
    CancelablePromise<Requests.App.Version.Response>
>(
    (
        _log: Logger,
        _request: Requests.App.Version.Request,
    ): CancelablePromise<Requests.App.Version.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            resolve(
                new Requests.App.Version.Response({
                    version: version.getVersion(),
                    error: undefined,
                }),
            );
        });
    },
);
