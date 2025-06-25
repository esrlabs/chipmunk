import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { Ident } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetSources.Request,
    CancelablePromise<Requests.Components.GetSources.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetSources.Request,
    ): CancelablePromise<Requests.Components.GetSources.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .get(request.origin)
                .sources()
                .then((list: Ident[]) => {
                    resolve(new Requests.Components.GetSources.Response({ list }));
                })
                .catch(reject);
        });
    },
);
