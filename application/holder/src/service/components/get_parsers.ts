import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { Ident } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetParsers.Request,
    CancelablePromise<Requests.Components.GetParsers.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetParsers.Request,
    ): CancelablePromise<Requests.Components.GetParsers.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .get(request.origin)
                .parsers()
                .then((list: Ident[]) => {
                    resolve(new Requests.Components.GetParsers.Response({ list }));
                })
                .catch(reject);
        });
    },
);
