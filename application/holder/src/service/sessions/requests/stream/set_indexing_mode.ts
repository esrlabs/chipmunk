import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Instance as Logger } from 'platform/env/logger';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.Mode.Request,
    CancelablePromise<Requests.Stream.Mode.Response>
>(
    (
        _log: Logger,
        request: Requests.Stream.Mode.Request,
    ): CancelablePromise<Requests.Stream.Mode.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .setIndexingMode(request.mode)
                .then(() => {
                    resolve(
                        new Requests.Stream.Mode.Response({
                            session: stored.session.getUUID(),
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Stream.Mode.Response({
                            session: stored.session.getUUID(),
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
