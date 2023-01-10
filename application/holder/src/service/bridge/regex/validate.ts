import { CancelablePromise } from 'platform/env/promise';
import { Instance as Logger } from 'platform/env/logger';
import { regex } from 'rustcore';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Search.RegEx.Request,
    CancelablePromise<Requests.Search.RegEx.Response>
>(
    (
        _log: Logger,
        request: Requests.Search.RegEx.Request,
    ): CancelablePromise<Requests.Search.RegEx.Response> => {
        return new CancelablePromise((resolve, _reject) => {
            const error = regex.getFilterError(request.filter);
            resolve(
                new Requests.Search.RegEx.Response({
                    error: error instanceof Error ? error.message : undefined,
                }),
            );
        });
    },
);
