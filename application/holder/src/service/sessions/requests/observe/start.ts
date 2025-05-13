import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Observe.Start.Request,
    CancelablePromise<Requests.Observe.Start.Response>
>(
    (
        log: Logger,
        request: Requests.Observe.Start.Request,
    ): CancelablePromise<Requests.Observe.Start.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored
                .observe()
                .start(request.options)
                .then(() => {
                    resolve(
                        new Requests.Observe.Start.Response({
                            session: stored.session.getUUID(),
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Observe.Start.Response({
                            session: stored.session.getUUID(),
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
