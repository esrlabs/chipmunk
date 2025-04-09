import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.Validate.Request,
    CancelablePromise<Requests.Components.Validate.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.Validate.Request,
    ): CancelablePromise<Requests.Components.Validate.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .validate(request.origin, request.target, request.fields)
                .then((errors: Map<string, string>) => {
                    resolve(new Requests.Components.Validate.Response({ errors }));
                })
                .catch(reject);
        });
    },
);
