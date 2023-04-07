import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Os.EnvVars.Request,
    CancelablePromise<Requests.Os.EnvVars.Response>
>(
    (
        _log: Logger,
        _request: Requests.Os.EnvVars.Request,
    ): CancelablePromise<Requests.Os.EnvVars.Response> => {
        return new CancelablePromise((resolve, reject) => {
            unbound.jobs
                .getContextEnvvars()
                .then((envvars) => {
                    resolve(new Requests.Os.EnvVars.Response({ envvars }));
                })
                .catch(reject);
        });
    },
);
