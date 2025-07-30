import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { ComponentsList } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetCompatibleSetup.Request,
    CancelablePromise<Requests.Components.GetCompatibleSetup.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetCompatibleSetup.Request,
    ): CancelablePromise<Requests.Components.GetCompatibleSetup.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .getCompatibleSetup(request.origin)
                .then((components: ComponentsList) => {
                    resolve(new Requests.Components.GetCompatibleSetup.Response({ components }));
                })
                .catch(reject);
        });
    },
);
