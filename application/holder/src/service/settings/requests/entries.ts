import { CancelablePromise } from 'platform/env/promise';
import { settings } from '@service/settings';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Settings.Entries.Request,
    CancelablePromise<Requests.Settings.Entries.Response>
>(
    (
        _log: Logger,
        _request: Requests.Settings.Entries.Request,
    ): CancelablePromise<Requests.Settings.Entries.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            resolve(
                new Requests.Settings.Entries.Response({
                    entries: settings.get().all(),
                }),
            );
        });
    },
);
