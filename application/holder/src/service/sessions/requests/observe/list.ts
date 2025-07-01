import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Observe.List.Request,
    CancelablePromise<Requests.Observe.List.Response>
>(
    (
        log: Logger,
        request: Requests.Observe.List.Request,
    ): CancelablePromise<Requests.Observe.List.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            resolve(
                new Requests.Observe.List.Response({
                    session: stored.session.getUUID(),
                    operations: stored.observe().list(),
                }),
            );
        });
    },
);
