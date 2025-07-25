import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { FieldDesc, OutputRender } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.IsSdeSupported.Request,
    CancelablePromise<Requests.Components.IsSdeSupported.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.IsSdeSupported.Request,
    ): CancelablePromise<Requests.Components.IsSdeSupported.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .isSdeSupported(request.uuid, request.origin)
                .then((support: boolean) => {
                    resolve(new Requests.Components.IsSdeSupported.Response({ support }));
                })
                .catch(reject);
        });
    },
);
