import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.ListActive.Request,
    CancelablePromise<Requests.Plugins.ListActive.Response>
>(
    (
        _log: Logger,
        _request: Requests.Plugins.ListActive.Request,
    ): CancelablePromise<Requests.Plugins.ListActive.Response> => {
        return new CancelablePromise((reslove, reject) => {
            unbound.jobs
                .getActivePlugins()
                .then((pluginsJson) => {
                    reslove(new Requests.Plugins.ListActive.Response({ pluginsJson }));
                })
                .catch(reject);
        });
    },
);
