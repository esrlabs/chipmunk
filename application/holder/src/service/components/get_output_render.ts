import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { FieldDesc, OutputRender } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetOutputRender.Request,
    CancelablePromise<Requests.Components.GetOutputRender.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetOutputRender.Request,
    ): CancelablePromise<Requests.Components.GetOutputRender.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .getOutputRender(request.uuid)
                .then((render: OutputRender | null) => {
                    resolve(new Requests.Components.GetOutputRender.Response({ render }));
                })
                .catch(reject);
        });
    },
);
