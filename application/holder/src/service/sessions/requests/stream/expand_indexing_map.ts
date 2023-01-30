import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.Expand.Request,
    CancelablePromise<Requests.Stream.Expand.Response>
>(
    (
        _log: Logger,
        request: Requests.Stream.Expand.Request,
    ): CancelablePromise<Requests.Stream.Expand.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .expandBreadcrumbs(request.seporator, request.offset, request.above)
                .then(() => {
                    resolve(
                        new Requests.Stream.Expand.Response({
                            session: stored.session.getUUID(),
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Stream.Expand.Response({
                            session: stored.session.getUUID(),
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
