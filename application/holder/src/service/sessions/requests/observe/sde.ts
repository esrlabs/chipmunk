import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';
import { SdeResponse } from 'platform/types/sde';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Observe.SDE.Request,
    CancelablePromise<Requests.Observe.SDE.Response>
>(
    (
        log: Logger,
        request: Requests.Observe.SDE.Request,
    ): CancelablePromise<Requests.Observe.SDE.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .sde(request.operation, request.request)
                .then((result: SdeResponse) => {
                    resolve(
                        new Requests.Observe.SDE.Response({
                            session: stored.session.getUUID(),
                            result,
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Observe.SDE.Response({
                            session: stored.session.getUUID(),
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
