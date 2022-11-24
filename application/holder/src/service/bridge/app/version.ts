import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { version } from '@module/version';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.App.Version.Request,
    CancelablePromise<Requests.App.Version.Response>
>(
    (
        log: Logger,
        request: Requests.App.Version.Request,
    ): CancelablePromise<Requests.App.Version.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            log.info(request);

            resolve(
                new Requests.App.Version.Response({
                    version: version.getVersion(),
                    error: undefined,
                }),
            );
        });
    },
);
