import { CancelablePromise } from 'platform/env/promise';
import { settings } from '@service/settings';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Settings.Set.Request,
    CancelablePromise<Requests.Settings.Set.Response>
>(
    (
        _log: Logger,
        request: Requests.Settings.Set.Request,
    ): CancelablePromise<Requests.Settings.Set.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const entry = settings.get().entry(request.path, request.key);
            if (entry === undefined) {
                return resolve(
                    new Requests.Settings.Set.Response({
                        error: `Entry ${request.path}:${request.key} doesn't exist`,
                    }),
                );
            }
            if (request.value === undefined) {
                if (entry.desc.allowEmpty) {
                    return resolve(
                        new Requests.Settings.Set.Response({
                            error: undefined,
                        }),
                    );
                } else {
                    return resolve(
                        new Requests.Settings.Set.Response({
                            error: `Cannot be empty`,
                        }),
                    );
                }
            }
            const error = entry.value.set(request.value);
            resolve(
                new Requests.Settings.Set.Response({
                    error: error instanceof Error ? error.message : undefined,
                }),
            );
        });
    },
);
