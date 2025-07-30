import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { FieldList } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetDefaultOptions.Request,
    CancelablePromise<Requests.Components.GetDefaultOptions.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetDefaultOptions.Request,
    ): CancelablePromise<Requests.Components.GetDefaultOptions.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .getDefaultOptions(request.origin, request.uuid)
                .then((fields: FieldList) => {
                    resolve(new Requests.Components.GetDefaultOptions.Response({ fields }));
                })
                .catch(reject);
        });
    },
);
