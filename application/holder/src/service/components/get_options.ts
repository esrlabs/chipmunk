import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { FieldDesc } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetOptions.Request,
    CancelablePromise<Requests.Components.GetOptions.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetOptions.Request,
    ): CancelablePromise<Requests.Components.GetOptions.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .getOptions(request.origin, request.targets)
                .then((options: Map<string, FieldDesc[]>) => {
                    resolve(new Requests.Components.GetOptions.Response({ options }));
                })
                .catch(reject);
        });
    },
);
