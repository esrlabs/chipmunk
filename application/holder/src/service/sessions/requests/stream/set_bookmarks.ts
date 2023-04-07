import { CancelablePromise } from 'platform/env/promise';
import { sessions } from '@service/sessions';
import { Logger } from 'platform/log';

import * as Requests from 'platform/ipc/request';

export const handler = Requests.InjectLogger<
    Requests.Stream.SetBookmarks.Request,
    CancelablePromise<Requests.Stream.SetBookmarks.Response>
>(
    (
        _log: Logger,
        request: Requests.Stream.SetBookmarks.Request,
    ): CancelablePromise<Requests.Stream.SetBookmarks.Response> => {
        return new CancelablePromise((resolve, reject) => {
            const stored = sessions.get(request.session);
            if (stored === undefined) {
                return reject(new Error(`Session doesn't exist`));
            }
            stored.session
                .getStream()
                .setBookmarks(request.rows)
                .then(() => {
                    resolve(
                        new Requests.Stream.SetBookmarks.Response({
                            session: stored.session.getUUID(),
                        }),
                    );
                })
                .catch((err: Error) => {
                    resolve(
                        new Requests.Stream.SetBookmarks.Response({
                            session: stored.session.getUUID(),
                            error: err.message,
                        }),
                    );
                });
        });
    },
);
