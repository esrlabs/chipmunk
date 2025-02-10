import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Plugins.ListAll.Request,
    CancelablePromise<Requests.Plugins.ListAll.Response>
>(
    (
        _log: Logger,
        _request: Requests.Plugins.ListAll.Request,
    ): CancelablePromise<Requests.Plugins.ListAll.Response> => {
        return new CancelablePromise((resolve, reject) => {
            unbound.jobs
                .getAllPlugins()
                .then((plugins) => {
                    resolve(new Requests.Plugins.ListAll.Response({ plugins }));
                })
                .catch(reject);
        });
    },
);
