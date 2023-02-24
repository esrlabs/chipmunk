import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { shells } from 'rustcore';

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
            shells
                .getContextEnvvars()
                .then((envvars) => {
                    resolve(new Requests.Os.EnvVars.Response({ envvars }));
                })
                .catch(reject);
        });
    },
);
