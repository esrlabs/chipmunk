import { CancelablePromise } from 'platform/env/promise';
import { settings } from '@service/settings';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Settings.Validate.Request,
    CancelablePromise<Requests.Settings.Validate.Response>
>(
    (
        _log: Logger,
        request: Requests.Settings.Validate.Request,
    ): CancelablePromise<Requests.Settings.Validate.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const entry = settings.get().entry(request.path, request.key);
            if (entry === undefined) {
                return resolve(
                    new Requests.Settings.Validate.Response({
                        error: `Entry ${request.path}:${request.key} doesn't exist`,
                    }),
                );
            }
            if (request.value === undefined) {
                if (entry.desc.allowEmpty) {
                    return resolve(
                        new Requests.Settings.Validate.Response({
                            error: undefined,
                        }),
                    );
                } else {
                    return resolve(
                        new Requests.Settings.Validate.Response({
                            error: `Cannot be empty`,
                        }),
                    );
                }
            }
            const error = entry.value.validate(request.value);
            resolve(
                new Requests.Settings.Validate.Response({
                    error: error instanceof Error ? error.message : undefined,
                }),
            );
        });
    },
);
