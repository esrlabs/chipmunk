import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { ShellProfile } from 'platform/types/bindings';
import { unbound } from '@service/unbound';

import * as Requests from 'platform/ipc/request';

let cached: ShellProfile[] | undefined = undefined;

export const handler = Requests.InjectLogger<
    Requests.Os.Shells.Request,
    CancelablePromise<Requests.Os.Shells.Response>
>(
    (
        _log: Logger,
        _request: Requests.Os.Shells.Request,
    ): CancelablePromise<Requests.Os.Shells.Response> => {
        return new CancelablePromise((resolve, reject) => {
            if (cached !== undefined) {
                resolve(new Requests.Os.Shells.Response({ shells: cached }));
            } else {
                unbound.jobs
                    .getShellProfiles()
                    .then((profiles) => {
                        cached = profiles;
                        resolve(new Requests.Os.Shells.Response({ shells: profiles }));
                    })
                    .catch(reject);
            }
        });
    },
);
