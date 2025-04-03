import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.ListInvalidPaths.Request,
    CancelablePromise<Requests.Plugins.ListInvalidPaths.Response>
>(
    (
        _log: Logger,
        _request: Requests.Plugins.ListInvalidPaths.Request,
    ): CancelablePromise<Requests.Plugins.ListInvalidPaths.Response> => {
        return new CancelablePromise((reslove, reject) => {
            unbound.jobs
                .invalidPluginsPaths()
                .then((paths) => {
                    reslove(new Requests.Plugins.ListInvalidPaths.Response({ paths }));
                })
                .catch(reject);
        });
    },
);
