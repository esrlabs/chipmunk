import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.Abort.Request,
    CancelablePromise<Requests.Components.Abort.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.Abort.Request,
    ): CancelablePromise<Requests.Components.Abort.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const error = components.components.abort(request.fields);
            if (error instanceof Error) {
                reject(error);
            } else {
                resolve(new Requests.Components.Abort.Response());
            }
        });
    },
);
