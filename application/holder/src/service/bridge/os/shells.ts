import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { shells } from 'rustcore';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Os.Shells.Request,
    CancelablePromise<Requests.Os.Shells.Response>
>(
    (
        _log: Logger,
        _request: Requests.Os.Shells.Request,
    ): CancelablePromise<Requests.Os.Shells.Response> => {
        return new CancelablePromise((resolve, reject) => {
            shells
                .getValidProfiles()
                .then((profiles) => {
                    resolve(new Requests.Os.Shells.Response({ profiles }));
                })
                .catch(reject);
        });
    },
);
