import { CancelablePromise } from 'platform/env/promise';
import { Logger } from 'platform/log';
import { components } from '@service/components';
import { Ident } from 'platform/types/bindings';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Components.GetIdent.Request,
    CancelablePromise<Requests.Components.GetIdent.Response>
>(
    (
        _log: Logger,
        request: Requests.Components.GetIdent.Request,
    ): CancelablePromise<Requests.Components.GetIdent.Response> => {
        return new CancelablePromise((resolve, reject) => {
            components.components
                .getIdent(request.target)
                .then((ident: Ident | undefined | null) => {
                    resolve(
                        new Requests.Components.GetIdent.Response({
                            ident: ident ? ident : undefined,
                        }),
                    );
                })
                .catch(reject);
        });
    },
);
